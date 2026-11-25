import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { Page } from '../../common/interfaces/page.interface';
import { Commit, CommitDocument } from '../repositories/schemas/commit.schema';
import { Repository, RepositoryDocument } from '../repositories/schemas/repository.schema';
import {
  TimelineEvent,
  TimelineEventDocument,
  TimelineEventType,
} from './schemas/timeline-event.schema';
import type { TimelineEventInsert } from './timeline-event.builder';

export interface TimelineQuery {
  projectId: Types.ObjectId;
  ownerId: Types.ObjectId;
  page: number;
  limit: number;
  type?: TimelineEventType;
  from?: Date;
  to?: Date;
  contributor?: string;
}

@Injectable()
export class TimelineRepository {
  constructor(
    @InjectModel(TimelineEvent.name)
    private readonly eventModel: Model<TimelineEventDocument>,
    @InjectModel(Repository.name)
    private readonly repositoryModel: Model<RepositoryDocument>,
    @InjectModel(Commit.name)
    private readonly commitModel: Model<CommitDocument>,
  ) {}

  async replaceForRepository(
    repositoryId: Types.ObjectId,
    ownerId: Types.ObjectId,
    events: TimelineEventInsert[],
  ): Promise<void> {
    await this.eventModel.deleteMany({ repositoryId, ownerId }).exec();
    if (events.length > 0) {
      await this.eventModel.insertMany(events, { ordered: false });
    }
  }

  async findPage(query: TimelineQuery): Promise<Page<TimelineEventDocument>> {
    const filter: Record<string, unknown> = {
      projectId: query.projectId,
      ownerId: query.ownerId,
    };
    if (query.type) filter.type = query.type;
    if (query.from || query.to) {
      const range: Record<string, Date> = {};
      if (query.from) range.$gte = query.from;
      if (query.to) range.$lte = query.to;
      filter.occurredAt = range;
    }
    if (query.contributor) {
      const pattern = new RegExp(escapeRegExp(query.contributor), 'i');
      filter.$or = [
        { contributorEmail: pattern },
        { contributorName: pattern },
      ];
    }

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      this.eventModel
        .find(filter)
        .sort({ occurredAt: -1, commitHash: -1 })
        .skip(skip)
        .limit(query.limit)
        .exec(),
      this.eventModel.countDocuments(filter).exec(),
    ]);
    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      },
    };
  }

  findByIdAndOwner(
    eventId: string,
    projectId: Types.ObjectId,
    ownerId: Types.ObjectId,
  ): Promise<TimelineEventDocument | null> {
    return this.eventModel.findOne({ _id: eventId, projectId, ownerId }).exec();
  }

  findRepositoryByProjectAndOwner(
    projectId: Types.ObjectId,
    ownerId: Types.ObjectId,
  ): Promise<RepositoryDocument | null> {
    return this.repositoryModel.findOne({ projectId, ownerId }).exec();
  }

  findRepositoryByIdAndOwner(
    repositoryId: Types.ObjectId,
    ownerId: Types.ObjectId,
  ): Promise<RepositoryDocument | null> {
    return this.repositoryModel.findOne({ _id: repositoryId, ownerId }).exec();
  }

  findCommitsAscending(
    repositoryId: Types.ObjectId,
    ownerId: Types.ObjectId,
  ): Promise<CommitDocument[]> {
    return this.commitModel
      .find({ repositoryId, ownerId })
      .sort({ committedAt: 1, hash: 1 })
      .exec();
  }

  async deleteForProject(
    projectId: Types.ObjectId,
    ownerId: Types.ObjectId,
  ): Promise<void> {
    await this.eventModel.deleteMany({ projectId, ownerId }).exec();
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
