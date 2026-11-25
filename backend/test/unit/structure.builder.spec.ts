import type { TimelineCommitInput } from '../../src/modules/timeline/timeline-event.builder';
import { buildReconstructedStructure } from '../../src/modules/timeline/structure.builder';

const commits: TimelineCommitInput[] = [
  {
    hash: 'c1',
    message: 'Initial files',
    authorName: 'Ada',
    authorEmail: 'ada@example.com',
    committedAt: new Date('2026-01-01T00:00:00.000Z'),
    fileChanges: [
      { status: 'A', path: 'src/index.ts' },
      { status: 'A', path: 'src/notes.txt' },
    ],
  },
  {
    hash: 'c2',
    message: 'Remove notes, add docs',
    authorName: 'Grace',
    authorEmail: 'grace@example.com',
    committedAt: new Date('2026-01-02T00:00:00.000Z'),
    fileChanges: [
      { status: 'D', path: 'src/notes.txt' },
      { status: 'A', path: 'docs/readme.md' },
      { status: 'M', path: 'src/index.ts' },
    ],
  },
];

describe('buildReconstructedStructure', () => {
  it('replays observed file changes up to the selected commit', () => {
    const structure = buildReconstructedStructure('repo-1', 'c2', commits);

    expect(structure).toMatchObject({
      repositoryId: 'repo-1',
      atCommitHash: 'c2',
      analyzedCommitCount: 2,
      fileCount: 2,
      confidence: 'detected',
    });
    expect(structure?.root.children.map((node) => node.path)).toEqual(['docs', 'src']);
    expect(structure?.root.children[1].children).toEqual([
      expect.objectContaining({
        path: 'src/index.ts',
        type: 'file',
        lastObservedCommitHash: 'c2',
        lastObservedStatus: 'M',
      }),
    ]);
    expect(structure?.basis).toContain('replaying observed Git file changes');
  });

  it('returns the structure at an earlier commit', () => {
    const structure = buildReconstructedStructure('repo-1', 'c1', commits);

    expect(structure?.fileCount).toBe(2);
    expect(structure?.root.children[0].children.map((node) => node.path)).toEqual([
      'src/index.ts',
      'src/notes.txt',
    ]);
  });

  it('returns null for an unknown commit', () => {
    expect(buildReconstructedStructure('repo-1', 'missing', commits)).toBeNull();
  });
});
