import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import type { Page } from '../../common/interfaces/page.interface';
import { TimelineQueryDto } from './dto/timeline-query.dto';
import {
  TimelineConfidence,
  TimelineEventDocument,
  TimelineEventType,
  TimelineEvidence,
} from './schemas/timeline-event.schema';
import { TimelineRepository } from './timeline.repository';
import {
  buildTimelineEvents,
  TimelineCommitInput,
} from './timeline-event.builder';
import {
  buildReconstructedStructure,
  ReconstructedStructure,
} from './structure.builder';

export interface TimelineEventView {
  id: string;
  type: TimelineEventType;
  occurredAt: string;
  title: string;
  description: string;
  confidence: TimelineConfidence;
  commitHash: string | null;
  contributorEmail: string | null;
  contributorName: string | null;
  paths: string[];
  evidence: TimelineEvidence[];
}

@Injectable()
export class TimelineService {
  constructor(private readonly timelineRepository: TimelineRepository) {}

  async rebuildFromCommits(
    ownerId: string,
    projectId: string,
    repositoryId: string,
    commits: TimelineCommitInput[],
  ): Promise<void> {
    await this.timelineRepository.replaceForRepository(
      new Types.ObjectId(repositoryId),
      new Types.ObjectId(ownerId),
      buildTimelineEvents({
        repositoryId: new Types.ObjectId(repositoryId),
        projectId: new Types.ObjectId(projectId),
        ownerId: new Types.ObjectId(ownerId),
        commits,
      }),
    );
  }

  async rebuildFromSnapshot(
    ownerId: string,
    projectId: string,
    repositoryId: string,
    snapshotName: string,
    files: { path: string; size: number }[],
    occurredAt: Date,
  ): Promise<void> {
    await this.timelineRepository.replaceForRepository(
      new Types.ObjectId(repositoryId),
      new Types.ObjectId(ownerId),
      buildTimelineEvents({
        repositoryId: new Types.ObjectId(repositoryId),
        projectId: new Types.ObjectId(projectId),
        ownerId: new Types.ObjectId(ownerId),
        snapshot: { snapshotName, occurredAt, files },
      }),
    );
  }

  async listForProject(
    ownerId: string,
    projectId: string,
    query: TimelineQueryDto,
  ): Promise<Page<TimelineEventView>> {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && from.getTime() > to.getTime()) {
      throw new BadRequestException('`from` must be before `to`');
    }

    const page = await this.timelineRepository.findPage({
      projectId: new Types.ObjectId(projectId),
      ownerId: new Types.ObjectId(ownerId),
      page: query.page,
      limit: query.limit,
      type: query.type,
      from,
      to,
      contributor: query.contributor,
    });
    return {
      items: page.items.map((event) => this.toEventView(event)),
      meta: page.meta,
    };
  }

  async findForProject(
    ownerId: string,
    projectId: string,
    eventId: string,
  ): Promise<TimelineEventView> {
    const event = await this.timelineRepository.findByIdAndOwner(
      eventId,
      new Types.ObjectId(projectId),
      new Types.ObjectId(ownerId),
    );
    if (!event) throw new NotFoundException('Timeline event not found');
    return this.toEventView(event);
  }

  async getProjectStructure(
    ownerId: string,
    projectId: string,
    at?: string,
  ): Promise<ReconstructedStructure> {
    const owner = new Types.ObjectId(ownerId);
    const repository = await this.timelineRepository.findRepositoryByProjectAndOwner(
      new Types.ObjectId(projectId),
      owner,
    );
    if (!repository) throw new NotFoundException('Repository not found');
    return this.buildStructure(repository.id, owner, at ?? repository.headCommitHash);
  }

  async getRepositoryStructure(
    ownerId: string,
    repositoryId: string,
    at?: string,
  ): Promise<ReconstructedStructure> {
    const owner = new Types.ObjectId(ownerId);
    const repository = await this.timelineRepository.findRepositoryByIdAndOwner(
      new Types.ObjectId(repositoryId),
      owner,
    );
    if (!repository) throw new NotFoundException('Repository not found');
    return this.buildStructure(repository.id, owner, at ?? repository.headCommitHash);
  }

  async deleteForProject(ownerId: string, projectId: string): Promise<void> {
    await this.timelineRepository.deleteForProject(
      new Types.ObjectId(projectId),
      new Types.ObjectId(ownerId),
    );
  }

  private async buildStructure(
    repositoryId: string,
    ownerId: Types.ObjectId,
    at: string | null,
  ): Promise<ReconstructedStructure> {
    if (!at) {
      throw new BadRequestException(
        'A commit hash is required; ZIP snapshots have no Git structure to reconstruct',
      );
    }
    const commits = await this.timelineRepository.findCommitsAscending(
      new Types.ObjectId(repositoryId),
      ownerId,
    );
    const structure = buildReconstructedStructure(
      repositoryId,
      at,
      commits.map(
        (commit): TimelineCommitInput => ({
          hash: commit.hash,
          message: commit.message,
          authorName: commit.authorName,
          authorEmail: commit.authorEmail,
          committedAt: commit.committedAt,
          fileChanges: commit.fileChanges,
        }),
      ),
    );
    if (!structure) throw new NotFoundException('Commit was not found in the analyzed history');
    return structure;
  }

  private toEventView(event: TimelineEventDocument): TimelineEventView {
    return {
      id: event.id,
      type: event.type,
      occurredAt: event.occurredAt.toISOString(),
      title: event.title,
      description: event.description,
      confidence: event.confidence,
      commitHash: event.commitHash,
      contributorEmail: event.contributorEmail,
      contributorName: event.contributorName,
      paths: event.paths,
      evidence: event.evidence,
    };
  }
}
