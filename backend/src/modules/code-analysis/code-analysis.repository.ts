import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Repository, RepositoryDocument } from '../repositories/schemas/repository.schema';
import {
  SnapshotFile,
  SnapshotFileDocument,
} from '../repositories/schemas/snapshot-file.schema';
import {
  AnalysisSnapshot,
  AnalysisSnapshotDocument,
} from './schemas/analysis-snapshot.schema';

@Injectable()
export class CodeAnalysisRepository {
  constructor(
    @InjectModel(AnalysisSnapshot.name)
    private readonly snapshotModel: Model<AnalysisSnapshotDocument>,
    @InjectModel(Repository.name)
    private readonly repositoryModel: Model<RepositoryDocument>,
    @InjectModel(SnapshotFile.name)
    private readonly fileModel: Model<SnapshotFileDocument>,
  ) {}

  findCached(
    repositoryId: Types.ObjectId,
    commitHash: string,
    analyzerVersion: string,
  ): Promise<AnalysisSnapshotDocument | null> {
    return this.snapshotModel
      .findOne({ repositoryId, commitHash, analyzerVersion })
      .exec();
  }

  save(
    document: Partial<AnalysisSnapshot>,
  ): Promise<AnalysisSnapshotDocument> {
    return this.snapshotModel.create(document);
  }

  async deleteCached(
    repositoryId: Types.ObjectId,
    commitHash: string,
    analyzerVersion: string,
  ): Promise<void> {
    await this.snapshotModel
      .deleteMany({ repositoryId, commitHash, analyzerVersion })
      .exec();
  }

  findLatest(
    repositoryId: Types.ObjectId,
    ownerId: Types.ObjectId,
  ): Promise<AnalysisSnapshotDocument | null> {
    return this.snapshotModel
      .findOne({ repositoryId, ownerId })
      .sort({ createdAt: -1 })
      .exec();
  }

  findByProjectAndCommit(
    projectId: Types.ObjectId,
    ownerId: Types.ObjectId,
    commitHash: string,
  ): Promise<AnalysisSnapshotDocument | null> {
    return this.snapshotModel
      .findOne({ projectId, ownerId, commitHash })
      .sort({ createdAt: -1 })
      .exec();
  }

  findByRepositoryAndCommit(
    repositoryId: Types.ObjectId,
    ownerId: Types.ObjectId,
    commitHash: string,
  ): Promise<AnalysisSnapshotDocument | null> {
    return this.snapshotModel
      .findOne({ repositoryId, ownerId, commitHash })
      .sort({ createdAt: -1 })
      .exec();
  }

  findRepositoryByIdAndOwner(
    repositoryId: Types.ObjectId,
    ownerId: Types.ObjectId,
  ): Promise<RepositoryDocument | null> {
    return this.repositoryModel.findOne({ _id: repositoryId, ownerId }).exec();
  }

  findRepositoryByProjectAndOwner(
    projectId: Types.ObjectId,
    ownerId: Types.ObjectId,
  ): Promise<RepositoryDocument | null> {
    return this.repositoryModel.findOne({ projectId, ownerId }).exec();
  }

  findSnapshotFiles(
    repositoryId: Types.ObjectId,
    ownerId: Types.ObjectId,
  ): Promise<SnapshotFileDocument[]> {
    return this.fileModel.find({ repositoryId, ownerId }).sort({ path: 1 }).exec();
  }

  async deleteForProject(
    projectId: Types.ObjectId,
    ownerId: Types.ObjectId,
  ): Promise<void> {
    await this.snapshotModel.deleteMany({ projectId, ownerId }).exec();
  }
}
