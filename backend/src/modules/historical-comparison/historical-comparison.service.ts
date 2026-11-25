import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { CodeAnalysisRepository } from '../code-analysis/code-analysis.repository';
import { DependencyAnalysisService } from '../dependency-analysis/dependency-analysis.service';
import { GitService } from '../repositories/git.service';
import { RepositoriesService, type CommitView } from '../repositories/repositories.service';
import type { RepositoryDocument } from '../repositories/schemas/repository.schema';
import { RepositoryStorageService } from '../repositories/repository-storage.service';
import { TimelineService } from '../timeline/timeline.service';
import {
  buildCommitComparison,
  buildSourceFileDiff,
  type CommitComparison,
  type ComparisonCommit,
  type SourceFileDiff,
} from './comparison.builder';

const MAX_DIFF_LINES = 2000;
const MAX_FILE_CHANGES = 500;

@Injectable()
export class HistoricalComparisonService {
  constructor(
    private readonly codeAnalysisRepository: CodeAnalysisRepository,
    private readonly dependencyAnalysisService: DependencyAnalysisService,
    private readonly gitService: GitService,
    private readonly repositoriesService: RepositoriesService,
    private readonly repositoryStorage: RepositoryStorageService,
    private readonly timelineService: TimelineService,
    private readonly configService: ConfigService,
  ) {}

  async compareProject(
    ownerId: string,
    projectId: string,
    from: string,
    to: string,
  ): Promise<CommitComparison> {
    this.assertCommitHash(from);
    this.assertCommitHash(to);
    const repository = await this.requireRepository(ownerId, projectId, true);
    const owner = new Types.ObjectId(ownerId);
    const id = new Types.ObjectId(projectId);
    const root = this.repositoryStorage.resolveReference(repository.localStorageReference);
    const limits: string[] = [];

    const [fromCommit, toCommit, fileChanges] = await Promise.all([
      this.repositoriesService.findProjectCommit(ownerId, projectId, from),
      this.repositoriesService.findProjectCommit(ownerId, projectId, to),
      this.gitService.diffNameStatus(root, from, to),
    ]);
    this.assertCommits(fromCommit, toCommit);
    if (fileChanges.length > MAX_FILE_CHANGES) {
      limits.push(
        `Only the first ${MAX_FILE_CHANGES} of ${fileChanges.length} observed file changes are shown.`,
      );
    }

    const [fromStructure, toStructure] = await Promise.all([
      this.timelineService.getProjectStructure(ownerId, projectId, from),
      this.timelineService.getProjectStructure(ownerId, projectId, to),
    ]);
    const [fromSnapshot, toSnapshot] = await Promise.all([
      this.codeAnalysisRepository.findByProjectAndCommit(id, owner, from),
      this.codeAnalysisRepository.findByProjectAndCommit(id, owner, to),
    ]);
    const analysesAvailable = Boolean(fromSnapshot && toSnapshot);
    if (!analysesAvailable) {
      limits.push(
        'Symbol and dependency diffs are unavailable because source analysis has not been run at both commits.',
      );
    }

    const dependencies = analysesAvailable
      ? await this.dependencyAnalysisService.compareProjectGraphs(ownerId, projectId, from, to)
      : null;

    return buildCommitComparison({
      fromCommit: toComparisonCommit(fromCommit!),
      toCommit: toComparisonCommit(toCommit!),
      fileChanges: fileChanges.slice(0, MAX_FILE_CHANGES),
      fromStructure,
      toStructure,
      fromFiles: fromSnapshot?.files,
      toFiles: toSnapshot?.files,
      dependencies,
      limits,
    });
  }

  async compareRepository(
    ownerId: string,
    repositoryId: string,
    from: string,
    to: string,
  ): Promise<CommitComparison> {
    this.assertCommitHash(from);
    this.assertCommitHash(to);
    const repository = await this.requireRepository(ownerId, repositoryId, false);
    return this.compareProject(ownerId, repository.projectId.toString(), from, to);
  }

  async compareProjectFile(
    ownerId: string,
    projectId: string,
    from: string,
    to: string,
    path: string,
  ): Promise<SourceFileDiff> {
    this.assertCommitHash(from);
    this.assertCommitHash(to);
    this.assertRepositoryPath(path);
    const repository = await this.requireRepository(ownerId, projectId, true);
    return this.readFileDiff(
      ownerId,
      projectId,
      repository,
      from,
      to,
      path,
      (owner, id, hash) =>
        this.repositoriesService.findProjectCommit(owner, id, hash),
    );
  }

  async compareRepositoryFile(
    ownerId: string,
    repositoryId: string,
    from: string,
    to: string,
    path: string,
  ): Promise<SourceFileDiff> {
    this.assertCommitHash(from);
    this.assertCommitHash(to);
    this.assertRepositoryPath(path);
    const repository = await this.requireRepository(ownerId, repositoryId, false);
    return this.readFileDiff(
      ownerId,
      repository.id,
      repository,
      from,
      to,
      path,
      (owner, id, hash) =>
        this.repositoriesService.findRepositoryCommit(owner, id, hash),
    );
  }

  private async readFileDiff(
    ownerId: string,
    projectId: string,
    repository: RepositoryDocument,
    from: string,
    to: string,
    path: string,
    findCommit: (ownerId: string, id: string, hash: string) => Promise<CommitView | null>,
  ): Promise<SourceFileDiff> {
    const [fromCommit, toCommit] = await Promise.all([
      findCommit(ownerId, projectId, from),
      findCommit(ownerId, projectId, to),
    ]);
    this.assertCommits(fromCommit, toCommit);

    const root = this.repositoryStorage.resolveReference(repository.localStorageReference);
    const [fromPaths, toPaths] = await Promise.all([
      this.gitService.listFilesAtCommit(root, from),
      this.gitService.listFilesAtCommit(root, to),
    ]);
    const fromExists = fromPaths.includes(path);
    const toExists = toPaths.includes(path);
    if (!fromExists && !toExists) {
      throw new NotFoundException('Path was not found in either selected commit');
    }

    const limits: string[] = [];
    const [fromContent, toContent] = await Promise.all([
      fromExists ? this.readOrNull(root, from, path, from, limits) : Promise.resolve(null),
      toExists ? this.readOrNull(root, to, path, to, limits) : Promise.resolve(null),
    ]);
    const maximum = Number(this.configService.get('MAX_DIFF_LINES') ?? MAX_DIFF_LINES);

    const diff = buildSourceFileDiff({
      path,
      fromCommitHash: from,
      toCommitHash: to,
      fromContent,
      toContent,
      fromExists,
      toExists,
      maxLines: Number.isFinite(maximum) && maximum > 0 ? maximum : MAX_DIFF_LINES,
    });
    return { ...diff, limits: [...diff.limits, ...limits] };
  }

  private async readOrNull(
    root: string,
    commitHash: string,
    path: string,
    label: string,
    limits: string[],
  ): Promise<string | null> {
    try {
      return await this.gitService.readFileAtCommit(root, commitHash, path);
    } catch {
      limits.push(`Source text could not be read at ${label}; that side is labelled unavailable.`);
      return null;
    }
  }

  private async requireRepository(
    ownerId: string,
    scopeId: string,
    byProject: boolean,
  ): Promise<RepositoryDocument> {
    this.assertObjectId(scopeId);
    const repository = byProject
      ? await this.codeAnalysisRepository.findRepositoryByProjectAndOwner(
          new Types.ObjectId(scopeId),
          new Types.ObjectId(ownerId),
        )
      : await this.codeAnalysisRepository.findRepositoryByIdAndOwner(
          new Types.ObjectId(scopeId),
          new Types.ObjectId(ownerId),
        );
    if (!repository) throw new NotFoundException('Repository not found');
    if (repository.sourceType !== 'git_url' || repository.status !== 'ready') {
      throw new BadRequestException(
        'Historical comparison requires a ready Git repository; ZIP snapshots have no commit history.',
      );
    }
    return repository;
  }

  private assertCommits(from: CommitView | null, to: CommitView | null): void {
    if (!from || !to) {
      throw new NotFoundException('Both commits must exist in the analyzed history');
    }
  }

  private assertCommitHash(value: string): void {
    if (!/^[0-9a-f]{4,40}$/i.test(value)) {
      throw new BadRequestException('Invalid commit hash');
    }
  }

  private assertObjectId(value: string): void {
    if (!/^[0-9a-f]{24}$/i.test(value)) {
      throw new BadRequestException('Invalid identifier');
    }
  }

  private assertRepositoryPath(path: string): void {
    if (
      !path ||
      path.startsWith('/') ||
      path.includes('\0') ||
      path.includes('\\') ||
      /^[A-Za-z]:/.test(path) ||
      path.split('/').some((segment) => segment === '..' || segment === '.')
    ) {
      throw new BadRequestException('Unsafe repository path');
    }
  }
}

function toComparisonCommit(commit: CommitView): ComparisonCommit {
  return {
    hash: commit.hash,
    message: commit.message,
    authorName: commit.authorName,
    authorEmail: commit.authorEmail,
    authoredAt: commit.authoredAt,
    committedAt: commit.committedAt,
    parentHashes: commit.parentHashes,
    fileChanges: commit.fileChanges,
  };
}
