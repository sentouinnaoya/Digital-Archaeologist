import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { simpleGit, type SimpleGit } from 'simple-git';
import { parseGitLog, type ParsedGitCommit } from './git-log.parser';

export interface GitMetadata {
  branches: string[];
  tags: string[];
  headCommitHash: string;
  totalCommitCount: number;
}

const LOG_FORMAT =
  '%x1e%H%x1f%an%x1f%ae%x1f%aI%x1f%cI%x1f%P%x1f%B';

@Injectable()
export class GitService {
  constructor(private readonly configService: ConfigService) {}

  async clone(remoteUrl: string, targetDirectory: string): Promise<void> {
    const parent = dirname(targetDirectory);
    await mkdir(parent, { recursive: true });
    const client = this.createClient(parent);
    await client.clone(remoteUrl, targetDirectory, ['--quiet']);
  }

  async readMetadata(localPath: string): Promise<GitMetadata> {
    const client = this.createClient(localPath);
    const [branchOutput, tagResult, head, countOutput] = await Promise.all([
      client.raw([
        'for-each-ref',
        '--format=%(refname:short)',
        'refs/heads',
        'refs/remotes',
      ]),
      client.tags(),
      client.raw(['rev-parse', 'HEAD']),
      client.raw(['rev-list', '--count', 'HEAD']),
    ]);

    const branchNames = String(branchOutput)
      .split('\n')
      .map((branch: string) => branch.trim())
      .filter(Boolean)
      .filter((branch: string) => branch !== 'HEAD' && !branch.endsWith('/HEAD'))
      .map((branch: string) => branch.replace(/^origin\//, ''));

    return {
      branches: [...new Set(branchNames)].sort(),
      tags: [...new Set(tagResult.all)].sort(),
      headCommitHash: String(head).trim(),
      totalCommitCount: Number.parseInt(String(countOutput).trim(), 10) || 0,
    };
  }

  async readCommits(localPath: string, maxCount: number): Promise<ParsedGitCommit[]> {
    const configuredMaximum = Number(
      this.configService.get('MAX_COMMITS_ANALYZED') ?? 2000,
    );
    const limit = Math.max(1, Math.min(maxCount, configuredMaximum));
    const client = this.createClient(localPath);
    const output = await client.raw([
      'log',
      `--max-count=${limit}`,
      `--format=${LOG_FORMAT}`,
      '--name-status',
      '--no-renames',
      '--topo-order',
    ]);
    return parseGitLog(output);
  }

  async listFilesAtCommit(localPath: string, commitHash: string): Promise<string[]> {
    this.assertCommitHash(commitHash);
    const client = this.createClient(localPath);
    const output = await client.raw([
      'ls-tree',
      '-r',
      '--name-only',
      '--full-tree',
      commitHash,
    ]);
    return String(output)
      .split(/\r?\n/)
      .map((path) => path.trim())
      .filter(Boolean)
      .filter((path) => !path.startsWith('"') && isSafeRepositoryPath(path));
  }

  async readFileAtCommit(
    localPath: string,
    commitHash: string,
    path: string,
  ): Promise<string> {
    this.assertCommitHash(commitHash);
    if (!isSafeRepositoryPath(path)) {
      throw new BadRequestException('Unsafe repository path');
    }
    const client = this.createClient(localPath);
    const output = await client.raw(['show', `${commitHash}:${path}`]);
    const content = Buffer.isBuffer(output) ? output.toString('utf8') : String(output);
    const maximumBytes =
      Number(this.configService.get('MAX_SOURCE_FILE_SIZE_MB') ?? 2) * 1024 * 1024;
    if (Buffer.byteLength(content, 'utf8') > maximumBytes) {
      throw new BadRequestException(
        `Source file exceeds the ${Math.round(maximumBytes / 1024 / 1024)} MB analysis limit`,
      );
    }
    return content;
  }

  async diffNameStatus(
    localPath: string,
    fromHash: string,
    toHash: string,
  ): Promise<Array<{ status: string; path: string }>> {
    this.assertCommitHash(fromHash);
    this.assertCommitHash(toHash);
    const client = this.createClient(localPath);
    const output = await client.raw([
      'diff',
      '--name-status',
      '--no-renames',
      fromHash,
      toHash,
    ]);
    return String(output)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        const separator = line.indexOf('\t');
        if (separator < 0) return [];
        const status = line.slice(0, separator).trim().charAt(0);
        const path = line.slice(separator + 1).trim();
        return status && isSafeRepositoryPath(path) ? [{ status, path }] : [];
      });
  }

  private assertCommitHash(commitHash: string): void {
    if (!/^[0-9a-f]{4,40}$/i.test(commitHash)) {
      throw new BadRequestException('Invalid commit hash');
    }
  }

  private createClient(baseDirectory: string): SimpleGit {
    const timeout = Number(this.configService.get('CLONE_TIMEOUT_MS') ?? 180000);
    return simpleGit({
      baseDir: baseDirectory,
      maxConcurrentProcesses: 1,
      timeout: { block: timeout },
      trimmed: false,
      strict: true,
      allowEnvironment: [
        'GIT_TERMINAL_PROMPT',
        'GCM_INTERACTIVE',
        'GIT_CONFIG_COUNT',
        'GIT_CONFIG_KEY_0',
        'GIT_CONFIG_VALUE_0',
        'GIT_CONFIG_KEY_1',
        'GIT_CONFIG_VALUE_1',
        'GIT_CONFIG_KEY_2',
        'GIT_CONFIG_VALUE_2',
      ],
      allowConfig: [
        'http.followRedirects',
        'protocol.file.allow',
        'credential.helper',
      ],
    }).env({
      GIT_TERMINAL_PROMPT: '0',
      GCM_INTERACTIVE: 'Never',
      GIT_CONFIG_COUNT: '3',
      GIT_CONFIG_KEY_0: 'http.followRedirects',
      GIT_CONFIG_VALUE_0: 'false',
      GIT_CONFIG_KEY_1: 'protocol.file.allow',
      GIT_CONFIG_VALUE_1: 'never',
      GIT_CONFIG_KEY_2: 'credential.helper',
      GIT_CONFIG_VALUE_2: '',
    });
  }
}

function isSafeRepositoryPath(path: string): boolean {
  if (
    !path ||
    path.startsWith('/') ||
    path.includes('\0') ||
    path.includes('\\') ||
    /^[A-Za-z]:/.test(path)
  ) {
    return false;
  }
  return !path.split('/').some((segment) => segment === '..' || segment === '.');
}
