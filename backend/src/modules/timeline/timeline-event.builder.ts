import { Types } from 'mongoose';
import {
  TimelineConfidence,
  TimelineEventType,
  TimelineEvidence,
} from './schemas/timeline-event.schema';

export interface TimelineCommitInput {
  hash: string;
  message: string;
  authorName: string;
  authorEmail: string;
  committedAt: Date;
  fileChanges: { status: string; path: string }[];
}

export interface TimelineSnapshotInput {
  snapshotName: string;
  occurredAt: Date;
  files: { path: string; size: number }[];
}

export interface TimelineEventInsert {
  repositoryId: Types.ObjectId;
  projectId: Types.ObjectId;
  ownerId: Types.ObjectId;
  type: TimelineEventType;
  occurredAt: Date;
  title: string;
  description: string;
  confidence: TimelineConfidence;
  commitHash: string | null;
  contributorEmail: string | null;
  contributorName: string | null;
  paths: string[];
  evidence: TimelineEvidence[];
}

export interface TimelineBuildInput {
  repositoryId: Types.ObjectId;
  projectId: Types.ObjectId;
  ownerId: Types.ObjectId;
  commits?: TimelineCommitInput[];
  snapshot?: TimelineSnapshotInput;
}

export function buildTimelineEvents(input: TimelineBuildInput): TimelineEventInsert[] {
  const events: TimelineEventInsert[] = [];

  for (const commit of input.commits ?? []) {
    const paths = [...new Set(commit.fileChanges.map((change) => change.path))];
    const countLabel =
      commit.fileChanges.length === 1 ? '1 file change' : `${commit.fileChanges.length} file changes`;
    events.push({
      repositoryId: input.repositoryId,
      projectId: input.projectId,
      ownerId: input.ownerId,
      type: 'commit',
      occurredAt: commit.committedAt,
      title: commit.message.split('\n')[0]?.trim() || `Commit ${commit.hash.slice(0, 8)}`,
      description: `Observed ${countLabel} in commit ${commit.hash.slice(0, 8)}.`,
      confidence: 'detected',
      commitHash: commit.hash,
      contributorEmail: commit.authorEmail,
      contributorName: commit.authorName,
      paths,
      evidence: [
        {
          kind: 'commit',
          commitHash: commit.hash,
          path: null,
          detail: `Verbatim commit message and author from Git commit ${commit.hash}.`,
        },
        ...commit.fileChanges.map((change) => ({
          kind: 'file' as const,
          commitHash: commit.hash,
          path: change.path,
          detail: `Git status ${change.status} observed for ${change.path} in ${commit.hash}.`,
        })),
      ],
    });

    for (const change of commit.fileChanges) {
      events.push({
        repositoryId: input.repositoryId,
      projectId: input.projectId,
      ownerId: input.ownerId,
        type: eventTypeForStatus(change.status),
        occurredAt: commit.committedAt,
        title: `${eventTitle(change.status)} ${change.path}`,
        description: `Observed Git status ${change.status} in commit ${commit.hash.slice(0, 8)}.`,
        confidence: 'detected',
        commitHash: commit.hash,
        contributorEmail: commit.authorEmail,
        contributorName: commit.authorName,
        paths: [change.path],
        evidence: [
          {
            kind: 'file',
            commitHash: commit.hash,
            path: change.path,
            detail: `Git status ${change.status} observed for ${change.path} in ${commit.hash}.`,
          },
        ],
      });
    }
  }

  if (input.snapshot) {
    const { snapshotName, occurredAt, files } = input.snapshot;
    events.push({
      repositoryId: input.repositoryId,
      projectId: input.projectId,
      ownerId: input.ownerId,
      type: 'snapshot',
      occurredAt,
      title: 'ZIP snapshot imported',
      description: `${files.length} observed file(s) in ${snapshotName}; no Git history was inferred.`,
      confidence: 'detected',
      commitHash: null,
      contributorEmail: null,
      contributorName: null,
      paths: files.map((file) => file.path),
      evidence: [
        {
          kind: 'structure',
          commitHash: null,
          path: null,
          detail: `File inventory extracted from the uploaded archive ${snapshotName}.`,
        },
      ],
    });
  }

  return events.sort(
    (left, right) =>
      right.occurredAt.getTime() - left.occurredAt.getTime() ||
      (right.commitHash ?? '').localeCompare(left.commitHash ?? ''),
  );
}

export function eventTypeForStatus(status: string): TimelineEventType {
  switch (status) {
    case 'A':
      return 'file_added';
    case 'D':
      return 'file_deleted';
    case 'R':
      return 'file_renamed';
    default:
      return 'file_modified';
  }
}

function eventTitle(status: string): string {
  switch (status) {
    case 'A':
      return 'Added';
    case 'D':
      return 'Deleted';
    case 'R':
      return 'Renamed';
    default:
      return 'Modified';
  }
}
