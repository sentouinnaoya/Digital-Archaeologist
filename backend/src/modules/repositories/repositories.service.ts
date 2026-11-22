import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { Page } from '../../common/interfaces/page.interface';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { detectLicense } from './license-detector';
import { GitMetadata, GitService } from './git.service';
import type { ParsedGitCommit } from './git-log.parser';
import { RemoteUrlValidator } from './remote-url.validator';
import {
  CommitInsert,
  ContributorRecord,
  RepositoriesRepository,
} from './repositories.repository';
import { RepositoryStorageService } from './repository-storage.service';
import {
  AnalysisJobDocument,
  JobStep,
  JobStatus,
} from './schemas/analysis-job.schema';
import { CommitDocument } from './schemas/commit.schema';
import {
  LicenseDetection,
  RepositoryDocument,
  RepositoryStatus,
} from './schemas/repository.schema';

export interface RepositoryView {
  id: string;
  projectId: string;
  sourceType: 'git_url';
  repositoryUrl: string;
  defaultBranch: string;
  status: RepositoryStatus;
  license: LicenseDetection | null;
  branches: string[];
  tags: string[];
  headCommitHash: string | null;
  totalCommitCount: number;
  analyzedCommitCount: number;
  detectedLanguages: string[];
  lastImportedAt: string | null;
  lastAnalyzedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobView {
  id: string;
  repositoryId: string;
  projectId: string;
  type: 'import' | 'reanalyze';
  status: JobStatus;
  progress: number;
  currentStep: string;
  error: string | null;
  steps: JobStep[];
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface CommitView {
  id: string;
  hash: string;
  message: string;
  authorName: string;
  authorEmail: string;
  authoredAt: string;
  committedAt: string;
  parentHashes: string[];
  fileChanges: { status: string; path: string }[];
}

export interface ContributorView {
  email: string;
  name: string;
  commitCount: number;
  firstCommitAt: string;
  lastCommitAt: string;
}

export interface RepositoryStatusView {
  repository: RepositoryView | null;
  job: JobView | null;
}

export interface ImportRepositoryInput {
  projectId: string;
  repositoryUrl: string;
  defaultBranch?: string;
}

const STEP_NAMES = [
  'validate_url',
  'clone',
  'license',
  'git_metadata',
  'commits',
  'persist',
] as const;

const STEP_LABELS: Record<string, string> = {
  validate_url: 'Validating repository URL',
  clone: 'Cloning repository',
  license: 'Detecting licence',
  git_metadata: 'Reading branches and tags',
  commits: 'Extracting commit history',
  persist: 'Storing analysis results',
};

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript',
  js: 'JavaScript',
  jsx: 'JavaScript',
  mjs: 'JavaScript',
  cjs: 'JavaScript',
  java: 'Java',
  kt: 'Kotlin',
  py: 'Python',
  go: 'Go',
  rs: 'Rust',
  rb: 'Ruby',
  php: 'PHP',
  cs: 'C#',
  c: 'C',
  h: 'C',
  cpp: 'C++',
  hpp: 'C++',
  swift: 'Swift',
  scala: 'Scala',
  sh: 'Shell',
  sql: 'SQL',
};

@Injectable()
export class RepositoriesService {
  private readonly logger = new Logger(RepositoriesService.name);

  constructor(
    private readonly repositoriesRepository: RepositoriesRepository,
    private readonly repositoryStorage: RepositoryStorageService,
    private readonly remoteUrlValidator: RemoteUrlValidator,
    private readonly gitService: GitService,
    private readonly configService: ConfigService,
    @InjectModel(Project.name)
    private readonly projectModel: Model<ProjectDocument>,
  ) {}

  async importRepository(
    ownerId: string,
    input: ImportRepositoryInput,
  ): Promise<{ repository: RepositoryView; job: JobView }> {
    const owner = new Types.ObjectId(ownerId);
    await this.assertProjectOwner(input.projectId, owner);

    const existing = await this.repositoriesRepository.findByProjectAndOwner(
      input.projectId,
      owner,
    );
    if (existing) {
      throw new ConflictException('This project already has an imported repository');
    }

    const repositoryUrl = await this.remoteUrlValidator.validate(input.repositoryUrl);
    const repositoryId = new Types.ObjectId();
    const reference = this.repositoryStorage.buildReference(
      input.projectId,
      repositoryId.toString(),
    );

    const repository = await this.repositoriesRepository.createRepository({
      _id: repositoryId,
      projectId: new Types.ObjectId(input.projectId),
      ownerId: owner,
      sourceType: 'git_url',
      repositoryUrl,
      defaultBranch: input.defaultBranch?.trim() || 'main',
      localStorageReference: reference,
    });

    const job = await this.repositoriesRepository.createJob({
      repositoryId,
      projectId: new Types.ObjectId(input.projectId),
      ownerId: owner,
      type: 'import',
    });

    await this.projectModel.updateOne(
      { _id: input.projectId, ownerId: owner },
      { $set: { analysisStatus: 'queued' } },
    );

    void this.executeJob(job, repositoryUrl, reference, true).catch((error: unknown) => {
      this.logger.error(`Import job ${job.id} failed unexpectedly`, error as Error);
    });

    return {
      repository: this.toRepositoryView(repository),
      job: this.toJobView(job),
    };
  }

  async reanalyze(ownerId: string, repositoryId: string): Promise<JobView> {
    const owner = new Types.ObjectId(ownerId);
    const repository = await this.getRepositoryEntity(repositoryId, owner);
    if (repository.status === 'importing') {
      throw new ConflictException('Repository import is still running');
    }

    const activeJob = await this.repositoriesRepository.findLatestJob(
      repository._id,
      owner,
    );
    if (
      activeJob &&
      (activeJob.status === 'queued' || activeJob.status === 'running')
    ) {
      throw new ConflictException('An analysis job is already running for this repository');
    }

    const job = await this.repositoriesRepository.createJob({
      repositoryId: repository._id,
      projectId: repository.projectId,
      ownerId: owner,
      type: 'reanalyze',
    });

    await this.projectModel.updateOne(
      { _id: repository.projectId, ownerId: owner },
      { $set: { analysisStatus: 'queued' } },
    );

    void this.executeJob(
      job,
      repository.repositoryUrl,
      repository.localStorageReference,
      false,
    ).catch((error: unknown) => {
      this.logger.error(`Analysis job ${job.id} failed unexpectedly`, error as Error);
    });

    return this.toJobView(job);
  }

  async getRepository(ownerId: string, repositoryId: string): Promise<RepositoryView> {
    return this.toRepositoryView(
      await this.getRepositoryEntity(repositoryId, new Types.ObjectId(ownerId)),
    );
  }

  async getProjectRepository(
    ownerId: string,
    projectId: string,
  ): Promise<RepositoryStatusView> {
    const owner = new Types.ObjectId(ownerId);
    await this.assertProjectOwner(projectId, owner);
    const repository = await this.repositoriesRepository.findByProjectAndOwner(
      projectId,
      owner,
    );
    if (!repository) return { repository: null, job: null };

    const job = await this.repositoriesRepository.findLatestJob(repository._id, owner);
    return {
      repository: this.toRepositoryView(repository),
      job: job ? this.toJobView(job) : null,
    };
  }

  async getStatus(ownerId: string, repositoryId: string): Promise<RepositoryStatusView> {
    const owner = new Types.ObjectId(ownerId);
    const repository = await this.getRepositoryEntity(repositoryId, owner);
    const job = await this.repositoriesRepository.findLatestJob(repository._id, owner);
    return {
      repository: this.toRepositoryView(repository),
      job: job ? this.toJobView(job) : null,
    };
  }

  async listJobs(ownerId: string, repositoryId: string): Promise<JobView[]> {
    const owner = new Types.ObjectId(ownerId);
    const repository = await this.getRepositoryEntity(repositoryId, owner);
    const jobs = await this.repositoriesRepository.listJobs(repository._id, owner);
    return jobs.map((job) => this.toJobView(job));
  }

  async listCommits(
    ownerId: string,
    repositoryId: string,
    page: number,
    limit: number,
  ): Promise<Page<CommitView>> {
    const owner = new Types.ObjectId(ownerId);
    const repository = await this.getRepositoryEntity(repositoryId, owner);
    const { items, total } = await this.repositoriesRepository.findCommitPage(
      repository._id,
      owner,
      (page - 1) * limit,
      limit,
    );
    return {
      items: items.map((commit) => this.toCommitView(commit)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async listBranches(ownerId: string, repositoryId: string): Promise<string[]> {
    const repository = await this.getRepositoryEntity(
      repositoryId,
      new Types.ObjectId(ownerId),
    );
    return repository.branches;
  }

  async listTags(ownerId: string, repositoryId: string): Promise<string[]> {
    const repository = await this.getRepositoryEntity(
      repositoryId,
      new Types.ObjectId(ownerId),
    );
    return repository.tags;
  }

  async listContributors(
    ownerId: string,
    repositoryId: string,
  ): Promise<ContributorView[]> {
    const owner = new Types.ObjectId(ownerId);
    const repository = await this.getRepositoryEntity(repositoryId, owner);
    const contributors = await this.repositoriesRepository.aggregateContributors(
      repository._id,
      owner,
    );
    return contributors.map((contributor) => this.toContributorView(contributor));
  }

  async listProjectCommits(
    ownerId: string,
    projectId: string,
    page: number,
    limit: number,
  ): Promise<Page<CommitView>> {
    const repository = await this.getProjectRepositoryEntity(
      projectId,
      new Types.ObjectId(ownerId),
    );
    return this.listCommits(ownerId, repository.id, page, limit);
  }

  async listProjectBranches(ownerId: string, projectId: string): Promise<string[]> {
    const repository = await this.getProjectRepositoryEntity(
      projectId,
      new Types.ObjectId(ownerId),
    );
    return repository.branches;
  }

  async listProjectTags(ownerId: string, projectId: string): Promise<string[]> {
    const repository = await this.getProjectRepositoryEntity(
      projectId,
      new Types.ObjectId(ownerId),
    );
    return repository.tags;
  }

  async listProjectContributors(
    ownerId: string,
    projectId: string,
  ): Promise<ContributorView[]> {
    const repository = await this.getProjectRepositoryEntity(
      projectId,
      new Types.ObjectId(ownerId),
    );
    return this.listContributors(ownerId, repository.id);
  }

  async deleteProjectData(projectId: string, ownerId: string): Promise<void> {
    const owner = new Types.ObjectId(ownerId);
    const reference = await this.repositoriesRepository.deleteForProject(
      new Types.ObjectId(projectId),
      owner,
    );
    if (reference) {
      await this.repositoryStorage.remove(reference);
    }
  }

  private async executeJob(
    job: AnalysisJobDocument,
    repositoryUrl: string,
    storageReference: string,
    isImport: boolean,
  ): Promise<void> {
    const ownerId = job.ownerId;
    const steps: JobStep[] = STEP_NAMES.map((name) => ({
      name,
      status: 'pending',
      startedAt: null,
      completedAt: null,
      error: null,
    }));

    const sync = async (
      status: JobStatus,
      progress: number,
      currentStep: string,
      error: string | null = null,
    ) => {
      await this.repositoriesRepository.updateJob(job._id, ownerId, {
        status,
        progress,
        currentStep,
        error,
        steps,
        startedAt: status === 'running' ? job.startedAt ?? new Date() : job.startedAt,
      });
    };

    const runStep = async <T>(
      name: string,
      progress: number,
      action: () => Promise<T>,
    ): Promise<T> => {
      const step = steps.find((entry) => entry.name === name);
      if (!step) throw new Error(`Unknown analysis step: ${name}`);
      step.status = 'running';
      step.startedAt = new Date();
      await sync('running', progress, STEP_LABELS[name]);
      try {
        const result = await action();
        step.status = 'completed';
        step.completedAt = new Date();
        await sync('running', progress + 8, STEP_LABELS[name]);
        return result;
      } catch (error) {
        step.status = 'failed';
        step.completedAt = new Date();
        step.error = this.errorMessage(error);
        await sync('failed', progress, STEP_LABELS[name], step.error);
        throw error;
      }
    };

    let localPath: string | null = null;
    job.startedAt = new Date();
    await sync('running', 4, 'Starting analysis');

    try {
      await runStep('validate_url', 6, async () => {
        if (isImport) await this.remoteUrlValidator.validate(repositoryUrl);
      });

      await runStep('clone', 14, async () => {
        if (isImport) {
          await this.repositoryStorage.remove(storageReference);
          localPath = await this.repositoryStorage.prepare(storageReference);
          await this.gitService.clone(repositoryUrl, localPath);

          const maximumBytes =
            Number(this.configService.get('MAX_CLONE_SIZE_MB') ?? 500) * 1024 * 1024;
          const size = await this.repositoryStorage.directorySize(
            storageReference,
            maximumBytes + 1,
          );
          if (size > maximumBytes) {
            throw new BadRequestException(
              `Repository exceeds the ${Math.round(maximumBytes / 1024 / 1024)} MB size limit`,
            );
          }
        } else {
          localPath = this.repositoryStorage.resolveReference(storageReference);
        }
      });

      const license = await runStep('license', 24, async () =>
        detectLicense(localPath as string),
      );

      const metadata = await runStep('git_metadata', 34, async () =>
        this.gitService.readMetadata(localPath as string),
      );

      const commits = await runStep('commits', 52, async () =>
        this.gitService.readCommits(
          localPath as string,
          Number(this.configService.get('MAX_COMMITS_ANALYZED') ?? 2000),
        ),
      );
      if (commits.length === 0) {
        throw new BadRequestException('Repository has no commit history to analyse');
      }

      await runStep('persist', 82, async () => {
        await this.persistResults(job, metadata, commits, license);
      });

      await this.repositoriesRepository.updateJob(job._id, ownerId, {
        status: 'completed',
        progress: 100,
        currentStep: 'Complete',
        error: null,
        steps,
        completedAt: new Date(),
      });
    } catch (error) {
      const message = this.errorMessage(error);
      this.logger.warn(`Analysis job ${job.id} failed: ${message}`);
      await this.repositoriesRepository.updateJob(job._id, ownerId, {
        status: 'failed',
        error: message,
        steps,
        completedAt: new Date(),
      });
      await this.repositoriesRepository.updateRepository(job.repositoryId, ownerId, {
        status: 'failed',
        lastError: message,
      });
      await this.projectModel.updateOne(
        { _id: job.projectId, ownerId },
        { $set: { analysisStatus: 'failed' } },
      );
      if (isImport) {
        await this.repositoryStorage.remove(storageReference);
      }
    }
  }

  private async persistResults(
    job: AnalysisJobDocument,
    metadata: GitMetadata,
    commits: ParsedGitCommit[],
    license: LicenseDetection,
  ): Promise<void> {
    const inserts: CommitInsert[] = commits.map((commit) => ({
      repositoryId: job.repositoryId,
      ownerId: job.ownerId,
      hash: commit.hash,
      message: commit.message,
      authorName: commit.authorName,
      authorEmail: commit.authorEmail,
      authoredAt: new Date(commit.authoredAt),
      committedAt: new Date(commit.committedAt),
      parentHashes: commit.parentHashes,
      fileChanges: commit.fileChanges,
    }));

    await this.repositoriesRepository.replaceCommits(
      job.repositoryId,
      job.ownerId,
      inserts,
    );

    const now = new Date();
    const detectedLanguages = this.detectLanguages(inserts);
    await this.repositoriesRepository.updateRepository(job.repositoryId, job.ownerId, {
      status: 'ready',
      license,
      branches: metadata.branches,
      tags: metadata.tags,
      headCommitHash: metadata.headCommitHash,
      totalCommitCount: metadata.totalCommitCount,
      analyzedCommitCount: inserts.length,
      detectedLanguages,
      lastImportedAt: now,
      lastAnalyzedAt: now,
      lastError: null,
    });

    await this.projectModel.updateOne(
      { _id: job.projectId, ownerId: job.ownerId },
      {
        $set: {
          analysisStatus: 'completed',
          lastAnalyzedAt: now,
          primaryLanguage: detectedLanguages[0] ?? null,
        },
      },
    );
  }

  private detectLanguages(commits: CommitInsert[]): string[] {
    const counts = new Map<string, number>();
    for (const commit of commits) {
      for (const change of commit.fileChanges) {
        const extension = change.path.split('.').pop()?.toLowerCase() ?? '';
        const language = LANGUAGE_EXTENSIONS[extension];
        if (language) counts.set(language, (counts.get(language) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([language]) => language);
  }

  private async assertProjectOwner(projectId: string, ownerId: Types.ObjectId): Promise<void> {
    const project = await this.projectModel
      .findOne({ _id: projectId, ownerId })
      .select('_id')
      .exec();
    if (!project) throw new NotFoundException('Project not found');
  }

  private async getRepositoryEntity(
    repositoryId: string,
    ownerId: Types.ObjectId,
  ): Promise<RepositoryDocument> {
    const repository = await this.repositoriesRepository.findByIdAndOwner(
      repositoryId,
      ownerId,
    );
    if (!repository) throw new NotFoundException('Repository not found');
    return repository;
  }

  private async getProjectRepositoryEntity(
    projectId: string,
    ownerId: Types.ObjectId,
  ): Promise<RepositoryDocument> {
    const repository = await this.repositoriesRepository.findByProjectAndOwner(
      projectId,
      ownerId,
    );
    if (!repository) throw new NotFoundException('Repository not found for this project');
    return repository;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown analysis error';
  }

  private toRepositoryView(repository: RepositoryDocument): RepositoryView {
    return {
      id: repository.id,
      projectId: repository.projectId.toString(),
      sourceType: repository.sourceType,
      repositoryUrl: repository.repositoryUrl,
      defaultBranch: repository.defaultBranch,
      status: repository.status,
      license: repository.license,
      branches: repository.branches,
      tags: repository.tags,
      headCommitHash: repository.headCommitHash,
      totalCommitCount: repository.totalCommitCount,
      analyzedCommitCount: repository.analyzedCommitCount,
      detectedLanguages: repository.detectedLanguages,
      lastImportedAt: repository.lastImportedAt?.toISOString() ?? null,
      lastAnalyzedAt: repository.lastAnalyzedAt?.toISOString() ?? null,
      lastError: repository.lastError,
      createdAt: repository.createdAt.toISOString(),
      updatedAt: repository.updatedAt.toISOString(),
    };
  }

  private toJobView(job: AnalysisJobDocument): JobView {
    return {
      id: job.id,
      repositoryId: job.repositoryId.toString(),
      projectId: job.projectId.toString(),
      type: job.type,
      status: job.status,
      progress: job.progress,
      currentStep: job.currentStep,
      error: job.error,
      steps: job.steps,
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
    };
  }

  private toCommitView(commit: CommitDocument): CommitView {
    return {
      id: commit.id,
      hash: commit.hash,
      message: commit.message,
      authorName: commit.authorName,
      authorEmail: commit.authorEmail,
      authoredAt: commit.authoredAt.toISOString(),
      committedAt: commit.committedAt.toISOString(),
      parentHashes: commit.parentHashes,
      fileChanges: commit.fileChanges,
    };
  }

  private toContributorView(contributor: ContributorRecord): ContributorView {
    return {
      email: contributor.email,
      name: contributor.name,
      commitCount: contributor.commitCount,
      firstCommitAt: contributor.firstCommitAt.toISOString(),
      lastCommitAt: contributor.lastCommitAt.toISOString(),
    };
  }
}
