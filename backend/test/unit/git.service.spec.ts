import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GitService } from '../../src/modules/repositories/git.service';

describe('GitService (real local repository)', () => {
  let root: string;
  let service: GitService;

  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, stdio: 'pipe' });

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'da-git-service-'));
    git('init', '-q');
    git('config', 'user.name', 'Evidence Tester');
    git('config', 'user.email', 'evidence@example.com');

    await writeFile(join(root, 'a.ts'), 'export const a = 1;\n');
    git('add', 'a.ts');
    git('commit', '-q', '-m', 'first commit', '-m', 'with a body');

    await writeFile(join(root, 'b.ts'), 'export const b = 2;\n');
    git('add', 'b.ts');
    git('commit', '-q', '-m', 'second commit');

    service = new GitService({ get: () => 10000 } as never);
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('reads real refs and commit counts', async () => {
    const metadata = await service.readMetadata(root);
    expect(metadata.headCommitHash).toMatch(/^[0-9a-f]{40}$/);
    expect(metadata.totalCommitCount).toBe(2);
    expect(metadata.branches.length).toBeGreaterThan(0);
  });

  it('extracts real commits, messages and changed paths', async () => {
    const commits = await service.readCommits(root, 10);
    expect(commits).toHaveLength(2);
    expect(commits[1]).toMatchObject({
      authorName: 'Evidence Tester',
      authorEmail: 'evidence@example.com',
      message: 'first commit\n\nwith a body',
      fileChanges: [{ status: 'A', path: 'a.ts' }],
    });
  });
});
