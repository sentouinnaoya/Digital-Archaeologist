import { Types } from 'mongoose';
import {
  buildTimelineEvents,
  TimelineCommitInput,
} from '../../src/modules/timeline/timeline-event.builder';

const base = {
  repositoryId: new Types.ObjectId(),
  projectId: new Types.ObjectId(),
  ownerId: new Types.ObjectId(),
};

const commits: TimelineCommitInput[] = [
  {
    hash: 'aaa111',
    message: 'Add parser\n\nLonger explanation.',
    authorName: 'Ada Lovelace',
    authorEmail: 'ada@example.com',
    committedAt: new Date('2026-01-01T00:00:00.000Z'),
    fileChanges: [{ status: 'A', path: 'src/parser.ts' }],
  },
  {
    hash: 'bbb222',
    message: 'Adjust parser and remove notes',
    authorName: 'Grace Hopper',
    authorEmail: 'grace@example.com',
    committedAt: new Date('2026-01-02T00:00:00.000Z'),
    fileChanges: [
      { status: 'M', path: 'src/parser.ts' },
      { status: 'D', path: 'notes.txt' },
    ],
  },
];

describe('buildTimelineEvents', () => {
  it('creates one commit event plus one event per observed file change', () => {
    const events = buildTimelineEvents({ ...base, commits });

    expect(events).toHaveLength(5);
    const firstCommit = events.find(
      (event) => event.type === 'commit' && event.commitHash === 'aaa111',
    );
    expect(firstCommit).toMatchObject({
      type: 'commit',
      title: 'Add parser',
      confidence: 'detected',
      commitHash: 'aaa111',
      contributorEmail: 'ada@example.com',
    });
    expect(events.filter((event) => event.type === 'commit')).toHaveLength(2);
    expect(events.filter((event) => event.type === 'file_added')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'file_modified')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'file_deleted')).toHaveLength(1);
    const added = events.find((event) => event.type === 'file_added');
    expect(added?.evidence[0]).toMatchObject({
      kind: 'file',
      path: 'src/parser.ts',
      detail: expect.stringContaining('Git status A'),
    });
    expect(firstCommit).not.toHaveProperty('commits');
  });

  it('creates a snapshot event with no commit metadata', () => {
    const events = buildTimelineEvents({
      ...base,
      snapshot: {
        snapshotName: 'legacy.zip',
        occurredAt: new Date('2026-02-01T00:00:00.000Z'),
        files: [{ path: 'src/app.ts', size: 12 }],
      },
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'snapshot',
      confidence: 'detected',
      commitHash: null,
      contributorEmail: null,
      paths: ['src/app.ts'],
    });
  });
});
