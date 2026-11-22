import { parseGitLog } from '../../src/modules/repositories/git-log.parser';

describe('parseGitLog', () => {
  it('preserves multiline messages and extracts file changes', () => {
    const raw =
      '\x1eabc123\x1fAlice Example\x1falice@example.com\x1f2026-01-01T00:00:00Z\x1f2026-01-01T00:00:00Z\x1f\x1ffirst commit\n\nbody line\n\n\nA\tsrc/a.ts\n' +
      '\x1edef456\x1fBob Example\x1fbob@example.com\x1f2026-01-02T00:00:00Z\x1f2026-01-02T00:00:00Z\x1fabc123\x1fsecond commit\n\nM\tsrc/a.ts\nD\told.txt\n';

    expect(parseGitLog(raw)).toEqual([
      {
        hash: 'abc123',
        authorName: 'Alice Example',
        authorEmail: 'alice@example.com',
        authoredAt: '2026-01-01T00:00:00Z',
        committedAt: '2026-01-01T00:00:00Z',
        parentHashes: [],
        message: 'first commit\n\nbody line',
        fileChanges: [{ status: 'A', path: 'src/a.ts' }],
      },
      {
        hash: 'def456',
        authorName: 'Bob Example',
        authorEmail: 'bob@example.com',
        authoredAt: '2026-01-02T00:00:00Z',
        committedAt: '2026-01-02T00:00:00Z',
        parentHashes: ['abc123'],
        message: 'second commit',
        fileChanges: [
          { status: 'M', path: 'src/a.ts' },
          { status: 'D', path: 'old.txt' },
        ],
      },
    ]);
  });

  it('returns an empty array for an empty history', () => {
    expect(parseGitLog('')).toEqual([]);
  });
});
