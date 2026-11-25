import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { Types } from 'mongoose';
import { GitService } from '../repositories/git.service';
import { RepositoryStorageService } from '../repositories/repository-storage.service';
import { RepositoryDocument } from '../repositories/schemas/repository.schema';
import { CodeAnalysisRepository } from './code-analysis.repository';
import {
  AnalysisSnapshotDocument,
  ParsedSourceFileRecord,
  SourceSummary,
} from './schemas/analysis-snapshot.schema';
import { parseSourceFile } from './source-parser';

export interface SourceAnalysisView {
  id: string;
  repositoryId: string;
  projectId: string;
  sourceType: 'git_url' | 'zip';
  commitHash: string;
  analyzerVersion: string;
  cached: boolean;
  files: ParsedSourceFileRecord[];
  summary: SourceSummary;
  createdAt: string;
  updatedAt: string;
}

interface SourceFileInput {
  path: string;
  content: string;
  size: number;
  readError?: string;
}

@Injectable()
export class CodeAnalysisService {
  constructor(
    private readonly repository: CodeAnalysisRepository,
    private readonly gitService: GitService,
    private readonly storage: RepositoryStorageService,
    private readonly configService: ConfigService,
  ) {}

  async analyzeRepository(
    ownerId: string,
    repositoryId: string,
    commitHash?: string,
    refresh = false,
  ): Promise<SourceAnalysisView> {
    const owner = new Types.ObjectId(ownerId);
    const repository = await this.repository.findRepositoryByIdAndOwner(
      new Types.ObjectId(repositoryId),
      owner,
    );
    if (!repository) throw new NotFoundException('Repository not found');

    const key = repository.sourceType === 'zip' ? 'snapshot' : (commitHash ?? repository.headCommitHash);
    if (!key) {
      throw new BadRequestException(
        'A commit hash is required before Git source analysis can run',
      );
    }
    const analyzerVersion = String(this.configService.get('ANALYZER_VERSION') ?? '0.1.0');
    const cached = await this.repository.findCached(
      repository._id,
      key,
      analyzerVersion,
    );
    if (cached && !refresh) return this.toView(cached, true);
    if (cached && refresh) {
      await this.repository.deleteCached(repository._id, key, analyzerVersion);
    }

    const allFiles = await this.collectFiles(repository, owner, key);
    const maximum = Number(this.configService.get('MAX_SOURCE_FILES_ANALYZED') ?? 500);
    const selected = allFiles.slice(0, Math.max(1, maximum));
    if (selected.length === 0) {
      throw new BadRequestException('No source files were available for analysis');
    }

    const files: ParsedSourceFileRecord[] = selected.map((file) =>
      parseSourceFile(file.path, file.content, file.size, file.readError),
    );
    const summary = this.summarize(files, allFiles.length > selected.length);
    try {
      const saved = await this.repository.save({
        repositoryId: repository._id,
        projectId: repository.projectId,
        ownerId: owner,
        sourceType: repository.sourceType,
        commitHash: key,
        analyzerVersion,
        files,
        summary,
      });
      return this.toView(saved, false);
    } catch {
      const existing = await this.repository.findCached(
        repository._id,
        key,
        analyzerVersion,
      );
      if (existing) return this.toView(existing, true);
      throw new BadRequestException('Source analysis could not be stored');
    }
  }

  async getRepositoryLatest(
    ownerId: string,
    repositoryId: string,
  ): Promise<SourceAnalysisView> {
    const owner = new Types.ObjectId(ownerId);
    const repository = await this.repository.findRepositoryByIdAndOwner(
      new Types.ObjectId(repositoryId),
      owner,
    );
    if (!repository) throw new NotFoundException('Repository not found');
    const snapshot = await this.repository.findLatest(repository._id, owner);
    if (!snapshot) throw new NotFoundException('No source analysis has been run');
    return this.toView(snapshot, true);
  }

  async getProjectLatest(
    ownerId: string,
    projectId: string,
  ): Promise<SourceAnalysisView> {
    const owner = new Types.ObjectId(ownerId);
    const repository = await this.repository.findRepositoryByProjectAndOwner(
      new Types.ObjectId(projectId),
      owner,
    );
    if (!repository) throw new NotFoundException('Repository not found');
    const snapshot = await this.repository.findLatest(repository._id, owner);
    if (!snapshot) throw new NotFoundException('No source analysis has been run');
    return this.toView(snapshot, true);
  }

  async deleteForProject(ownerId: string, projectId: string): Promise<void> {
    await this.repository.deleteForProject(
      new Types.ObjectId(projectId),
      new Types.ObjectId(ownerId),
    );
  }

  private async collectFiles(
    repository: RepositoryDocument,
    owner: Types.ObjectId,
    key: string,
  ): Promise<SourceFileInput[]> {
    const root = this.storage.resolveReference(repository.localStorageReference);
    if (repository.sourceType === 'git_url') {
      const paths = await this.gitService.listFilesAtCommit(root, key);
      return this.readGitFiles(root, key, paths);
    }

    const records = await this.repository.findSnapshotFiles(repository._id, owner);
    const files: SourceFileInput[] = [];
    for (const record of records) {
      const fullPath = resolve(root, record.path);
      const containment = relative(root, fullPath);
      if (
        containment === '' ||
        containment === '..' ||
        containment.startsWith(`..${sep}`) ||
        isAbsolute(containment)
      ) {
        throw new BadRequestException('Snapshot file path escapes the storage directory');
      }
      try {
        const content = await readFile(fullPath, 'utf8');
        files.push({ path: record.path, content, size: Buffer.byteLength(content) });
      } catch {
        files.push({
          path: record.path,
          content: '',
          size: record.size,
          readError: 'Stored snapshot file could not be read',
        });
      }
    }
    return files;
  }

  private async readGitFiles(
    root: string,
    commitHash: string,
    paths: string[],
  ): Promise<SourceFileInput[]> {
    const files: SourceFileInput[] = [];
    for (const path of paths) {
      try {
        const content = await this.gitService.readFileAtCommit(root, commitHash, path);
        files.push({ path, content, size: Buffer.byteLength(content, 'utf8') });
      } catch {
        files.push({
          path,
          content: '',
          size: 0,
          readError: 'Source file could not be read at this commit',
        });
      }
    }
    return files;
  }

  private summarize(files: ParsedSourceFileRecord[], fileLimitApplied: boolean): SourceSummary {
    return {
      fileCount: files.length,
      parsedCount: files.filter((file) => file.status === 'parsed').length,
      syntaxErrorCount: files.filter((file) => file.status === 'syntax_error').length,
      unsupportedCount: files.filter((file) => file.status === 'unsupported').length,
      failedCount: files.filter((file) => file.status === 'parse_failed').length,
      symbolCount: files.reduce((total, file) => total + file.symbols.length, 0),
      importCount: files.reduce((total, file) => total + file.imports.length, 0),
      fileLimitApplied,
    };
  }

  private toView(
    document: AnalysisSnapshotDocument,
    cached: boolean,
  ): SourceAnalysisView {
    return {
      id: document.id,
      repositoryId: document.repositoryId.toString(),
      projectId: document.projectId.toString(),
      sourceType: document.sourceType,
      commitHash: document.commitHash,
      analyzerVersion: document.analyzerVersion,
      cached,
      files: document.files,
      summary: document.summary,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    };
  }
}
