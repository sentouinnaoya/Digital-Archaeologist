import { Injectable } from '@nestjs/common';
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
