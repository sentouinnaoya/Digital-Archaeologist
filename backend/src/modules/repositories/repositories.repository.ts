import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AnalysisJob, AnalysisJobDocument } from './schemas/analysis-job.schema';
import { Commit, CommitDocument } from './schemas/commit.schema';
import { Repository, RepositoryDocument } from './schemas/repository.schema';

export interface CreateRepositoryInput {
  _id: Types.ObjectId;
  projectId: Types.ObjectId;
  ownerId: Types.ObjectId;
  sourceType: 'git_url';
  repositoryUrl: string;
  defaultBranch: string;
  localStorageReference: string;
}

export interface CreateJobInput {
  repositoryId: Types.ObjectId;
  projectId: Types.ObjectId;
  ownerId: Types.ObjectId;
  type: 'import' | 'reanalyze';
}

export interface CommitInsert {
  repositoryId: Types.ObjectId;
  ownerId: Types.ObjectId;
  hash: string;
  message: string;
  authorName: string;
  authorEmail: string;
  authoredAt: Date;
  committedAt: Date;
  parentHashes: string[];
  fileChanges: { status: string; path: string }[];
}

export interface ContributorRecord {
  email: string;
  name: string;
  commitCount: number;
  firstCommitAt: Date;
  lastCommitAt: Date;
}

@Injectable()
export class RepositoriesRepository {
  constructor(
    @InjectModel(Repository.name)
    private readonly repositoryModel: Model<RepositoryDocument>,
    @InjectModel(Commit.name)
    private readonly commitModel: Model<CommitDocument>,
    @InjectModel(AnalysisJob.name)
    private readonly jobModel: Model<AnalysisJobDocument>,
  ) {}

  createRepository(input: CreateRepositoryInput): Promise<RepositoryDocument> {
    return this.repositoryModel.create(input);
  }

  findByIdAndOwner(id: string, ownerId: Types.ObjectId): Promise<RepositoryDocument | null> {
    return this.repositoryModel.findOne({ _id: id, ownerId }).exec();
  }

  findByProjectAndOwner(
    projectId: string,
    ownerId: Types.ObjectId,
  ): Promise<RepositoryDocument | null> {
    return this.repositoryModel.findOne({ projectId, ownerId }).exec();
  }

  updateRepository(
    id: Types.ObjectId,
    ownerId: Types.ObjectId,
    patch: Record<string, unknown>,
  ): Promise<RepositoryDocument | null> {
    return this.repositoryModel
      .findOneAndUpdate(
        { _id: id, ownerId },
        { $set: patch },
        { returnDocument: 'after', runValidators: true },
      )
      .exec();
  }

  createJob(input: CreateJobInput): Promise<AnalysisJobDocument> {
    return this.jobModel.create(input);
  }

  findJobByIdAndOwner(
    id: string,
    ownerId: Types.ObjectId,
  ): Promise<AnalysisJobDocument | null> {
    return this.jobModel.findOne({ _id: id, ownerId }).exec();
  }

  findLatestJob(
    repositoryId: Types.ObjectId,
    ownerId: Types.ObjectId,
  ): Promise<AnalysisJobDocument | null> {
    return this.jobModel
      .findOne({ repositoryId, ownerId })
      .sort({ createdAt: -1 })
      .exec();
  }

  listJobs(
    repositoryId: Types.ObjectId,
    ownerId: Types.ObjectId,
    limit = 20,
  ): Promise<AnalysisJobDocument[]> {
    return this.jobModel
      .find({ repositoryId, ownerId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  updateJob(
    id: Types.ObjectId,
    ownerId: Types.ObjectId,
    patch: Record<string, unknown>,
  ): Promise<AnalysisJobDocument | null> {
    return this.jobModel
      .findOneAndUpdate(
        { _id: id, ownerId },
        { $set: patch },
        { returnDocument: 'after', runValidators: true },
      )
      .exec();
  }

  async replaceCommits(
    repositoryId: Types.ObjectId,
    ownerId: Types.ObjectId,
    commits: CommitInsert[],
  ): Promise<void> {
    await this.commitModel.deleteMany({ repositoryId, ownerId }).exec();
    if (commits.length > 0) {
      await this.commitModel.insertMany(commits, { ordered: false });
    }
  }

  async findCommitPage(
    repositoryId: Types.ObjectId,
    ownerId: Types.ObjectId,
    skip: number,
    limit: number,
  ): Promise<{ items: CommitDocument[]; total: number }> {
    const filter = { repositoryId, ownerId };
    const [items, total] = await Promise.all([
      this.commitModel
        .find(filter)
        .sort({ committedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.commitModel.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  async aggregateContributors(
    repositoryId: Types.ObjectId,
    ownerId: Types.ObjectId,
  ): Promise<ContributorRecord[]> {
    return this.commitModel
      .aggregate<ContributorRecord>([
        { $match: { repositoryId, ownerId } },
        {
          $group: {
            _id: '$authorEmail',
            name: { $first: '$authorName' },
            commitCount: { $sum: 1 },
            firstCommitAt: { $min: '$authoredAt' },
            lastCommitAt: { $max: '$authoredAt' },
          },
        },
        {
          $project: {
            _id: 0,
            email: '$_id',
            name: 1,
            commitCount: 1,
            firstCommitAt: 1,
            lastCommitAt: 1,
          },
        },
        { $sort: { commitCount: -1, email: 1 } },
      ])
      .exec();
  }

  async deleteForProject(
    projectId: Types.ObjectId,
    ownerId: Types.ObjectId,
  ): Promise<string | null> {
    const repository = await this.repositoryModel
      .findOne({ projectId, ownerId })
      .exec();
    if (!repository) return null;

    await Promise.all([
      this.commitModel.deleteMany({ repositoryId: repository._id }).exec(),
      this.jobModel.deleteMany({ repositoryId: repository._id }).exec(),
    ]);
    await this.repositoryModel.deleteOne({ _id: repository._id }).exec();
    return repository.localStorageReference;
  }
}
