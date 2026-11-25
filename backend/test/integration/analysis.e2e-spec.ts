import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Test } from '@nestjs/testing';
import { Connection, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { OllamaAdapter } from '../../src/modules/ai-assistant/ollama.adapter';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';
import type { ParsedGitCommit } from '../../src/modules/repositories/git-log.parser';
import { GitService, type GitMetadata } from '../../src/modules/repositories/git.service';
import { RemoteUrlValidator } from '../../src/modules/repositories/remote-url.validator';

interface IntegrationFixture {
  commits: ParsedGitCommit[];
  metadata: GitMetadata;
  sourceFiles: Record<string, Record<string, string>>;
}

const SOURCE_FIXTURE: IntegrationFixture = {
  commits: [
    {
      hash: 'aaa111',
      authorName: 'Ada Lovelace',
      authorEmail: 'ada@example.com',
      authoredAt: '2026-01-01T00:00:00.000Z',
      committedAt: '2026-01-01T00:00:00.000Z',
      parentHashes: [],
      message: 'Initial implementation',
      fileChanges: [{ status: 'A', path: 'src/app.ts' }],
    },
  ],
  metadata: {
    branches: ['main'],
    tags: [],
    headCommitHash: 'aaa111',
    totalCommitCount: 1,
  },
  sourceFiles: {
    aaa111: {
      'src/app.ts': `import { Helper } from './helper';
export class App { start(): string { return 'ok'; } }
`,
      'src/Legacy.java': `package legacy;
public class Legacy { public void run() {} }
`,
      'notes.txt': 'Plain notes',
    },
  },
};

const GRAPH_FIXTURE: IntegrationFixture = {
  commits: [
    {
      hash: 'aaa111',
      authorName: 'Ada Lovelace',
      authorEmail: 'ada@example.com',
      authoredAt: '2026-01-01T00:00:00.000Z',
      committedAt: '2026-01-01T00:00:00.000Z',
      parentHashes: [],
      message: 'Initial modules',
      fileChanges: [
        { status: 'A', path: 'src/a.ts' },
        { status: 'A', path: 'src/b.ts' },
      ],
    },
    {
      hash: 'bbb222',
      authorName: 'Grace Hopper',
      authorEmail: 'grace@example.com',
      authoredAt: '2026-01-02T00:00:00.000Z',
      committedAt: '2026-01-02T00:00:00.000Z',
      parentHashes: ['aaa111'],
      message: 'Break cycle',
      fileChanges: [
        { status: 'M', path: 'src/a.ts' },
        { status: 'A', path: 'src/new.ts' },
      ],
    },
  ],
  metadata: {
    branches: ['main'],
    tags: [],
    headCommitHash: 'bbb222',
    totalCommitCount: 2,
  },
  sourceFiles: {
    aaa111: {
      'src/a.ts': `import { b } from './b';
export const a = b;
`,
      'src/b.ts': `import { a } from './a';
export const b = a;
`,
    },
    bbb222: {
      'src/a.ts': `import { useMemo } from 'react';
export const a = useMemo;
`,
      'src/b.ts': `export const b = 2;
`,
      'src/new.ts': `export const next = 3;
`,
    },
  },
};

const ARCHITECTURE_FIXTURE: IntegrationFixture = {
  commits: [
    {
      hash: 'aaa111',
      authorName: 'Ada Lovelace',
      authorEmail: 'ada@example.com',
      authoredAt: '2026-01-01T00:00:00.000Z',
      committedAt: '2026-01-01T00:00:00.000Z',
      parentHashes: [],
      message: 'Initial structure',
      fileChanges: [
        { status: 'A', path: 'src/main.ts' },
        { status: 'A', path: 'src/core/user-service.ts' },
        { status: 'A', path: 'src/api/handler.ts' },
        { status: 'A', path: 'src/admin/server.ts' },
        { status: 'A', path: 'Dockerfile' },
      ],
    },
    {
      hash: 'bbb222',
      authorName: 'Grace Hopper',
      authorEmail: 'grace@example.com',
      authoredAt: '2026-01-02T00:00:00.000Z',
      committedAt: '2026-01-02T00:00:00.000Z',
      parentHashes: ['aaa111'],
      message: 'Remove deployment file',
      fileChanges: [{ status: 'D', path: 'Dockerfile' }],
    },
  ],
  metadata: {
    branches: ['main'],
    tags: [],
    headCommitHash: 'bbb222',
    totalCommitCount: 2,
  },
  sourceFiles: {
    aaa111: {
      'src/main.ts': `import express from 'express';
import { UserService } from './core/user-service';
export const app = express();
`,
      'src/core/user-service.ts': `export class UserService {}
import { handle } from './../api/handler';
`,
      'src/api/handler.ts': `import axios from 'axios';
export const handle = axios;
`,
      'src/admin/server.ts': `export const server = true;
`,
      Dockerfile: 'FROM node:22\n',
    },
    bbb222: {
      'src/main.ts': `import express from 'express';
import { UserService } from './core/user-service';
export const app = express();
`,
      'src/core/user-service.ts': `export class UserService {}
import { handle } from './../api/handler';
`,
      'src/api/handler.ts': `import axios from 'axios';
export const handle = axios;
`,
      'src/admin/server.ts': `export const server = true;
`,
    },
  },
};

const COMPARISON_FIXTURE: IntegrationFixture = {
  commits: [
    {
      hash: 'aaa111',
      authorName: 'Ada Lovelace',
      authorEmail: 'ada@example.com',
      authoredAt: '2026-01-01T00:00:00.000Z',
      committedAt: '2026-01-01T00:00:00.000Z',
      parentHashes: [],
      message: 'Initial implementation',
      fileChanges: [
        { status: 'A', path: 'src/app.ts' },
        { status: 'A', path: 'src/legacy.ts' },
      ],
    },
    {
      hash: 'bbb222',
      authorName: 'Grace Hopper',
      authorEmail: 'grace@example.com',
      authoredAt: '2026-01-02T00:00:00.000Z',
      committedAt: '2026-01-02T00:00:00.000Z',
      parentHashes: ['aaa111'],
      message: 'Add inspector and remove legacy path',
      fileChanges: [
        { status: 'M', path: 'src/app.ts' },
        { status: 'A', path: 'src/new.ts' },
        { status: 'D', path: 'src/legacy.ts' },
      ],
    },
  ],
  metadata: {
    branches: ['main'],
    tags: [],
    headCommitHash: 'bbb222',
    totalCommitCount: 2,
  },
  sourceFiles: {
    aaa111: {
      'src/app.ts': `export const version = 1;
export class Runner { run(): void {} }
`,
      'src/legacy.ts': `export const old = true;
`,
    },
    bbb222: {
      'src/app.ts': `export const version = 2;
export class Runner { run(): void {} }
export class Inspector { inspect(): void {} }
`,
      'src/new.ts': `export const added = true;
`,
    },
  },
};

// Native Tree-sitter bindings cannot be safely reloaded when Jest reuses a
// worker across separate test files. All flows that call the parser therefore
// live in this single suite; graph construction itself is unit-tested.
describe('Analysis (integration)', () => {
  let app: INestApplication;
  let connection: Connection;
  let storageRoot: string;
  let activeFixture: IntegrationFixture;
  let ollamaEnabled = true;
  const server = () => app.getHttpServer();
  const gitStub = {
    clone: jest.fn(async (_url: string, target: string) => {
      await mkdir(target, { recursive: true });
      await writeFile(resolve(target, 'README.md'), 'Fixture repository');
    }),
    readMetadata: jest.fn(async () => activeFixture.metadata),
    readCommits: jest.fn(async () => activeFixture.commits),
    listFilesAtCommit: jest.fn(async (_root: string, hash: string) =>
      Object.keys(activeFixture.sourceFiles[hash] ?? {})),
    readFileAtCommit: jest.fn(async (_root: string, hash: string, path: string) =>
      activeFixture.sourceFiles[hash]?.[path] ?? ''),
    diffNameStatus: jest.fn(async (_root: string, from: string, to: string) => {
      const before = activeFixture.sourceFiles[from] ?? {};
      const after = activeFixture.sourceFiles[to] ?? {};
      return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap((path) => {
        if (!(path in before)) return [{ status: 'A', path }];
        if (!(path in after)) return [{ status: 'D', path }];
        return before[path] === after[path] ? [] : [{ status: 'M', path }];
      });
    }),
  };
  const validatorStub = { validate: jest.fn(async (url: string) => url) };
  const ollamaStub = {
    isEnabled: jest.fn(() => ollamaEnabled),
    getModel: jest.fn(() => 'test-local-model'),
    generate: jest.fn(async (prompt: string) => {
      const match = prompt.match(/\[EVIDENCE id="([^"]+)"/);
      return JSON.stringify({
        answer: 'The stored evidence records project metadata and analysed files.',
        evidenceIds: match ? [match[1]] : [],
      });
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GitService)
      .useValue(gitStub)
      .overrideProvider(RemoteUrlValidator)
      .useValue(validatorStub)
      .overrideProvider(OllamaAdapter)
      .useValue(ollamaStub)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();

    connection = moduleRef.get<Connection>(getConnectionToken());
    const config = moduleRef.get(ConfigService);
    storageRoot = resolve(process.cwd(), String(config.get('STORAGE_ROOT')));
  });

  afterAll(async () => {
    if (connection) await connection.dropDatabase();
    if (app) await app.close();
    await rm(storageRoot, { recursive: true, force: true });
  });

  beforeEach(() => {
    ollamaEnabled = true;
  });

  async function createUser(fullName: string, email: string): Promise<string> {
    const response = await request(server())
      .post('/api/v1/auth/register')
      .send({ fullName, email, password: 'testing123' })
      .expect(201);
    return response.body.data.accessToken;
  }

  async function importFixture(token: string, name: string): Promise<{
    projectId: string;
    repositoryId: string;
  }> {
    const project = await request(server())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name })
      .expect(201);
    const projectId: string = project.body.data.id;

    const imported = await request(server())
      .post('/api/v1/repositories/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ projectId, repositoryUrl: 'https://github.com/example/repository.git' })
      .expect(202);
    const repositoryId: string = imported.body.data.repository.id;

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const status = await request(server())
        .get(`/api/v1/repositories/projects/${projectId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      if (status.body.data.job.status === 'completed') return { projectId, repositoryId };
      if (status.body.data.job.status === 'failed') {
        throw new Error(status.body.data.job.error);
      }
      await new Promise((done) => setTimeout(done, 100));
    }
    throw new Error('Timed out waiting for import');
  }

  it('parses real source text, caches by commit/version and enforces ownership', async () => {
    activeFixture = SOURCE_FIXTURE;
    const token = await createUser('Source Tester', `source-owner-${Date.now()}@example.com`);
    const otherToken = await createUser('Source Other', `source-other-${Date.now()}@example.com`);
    const { projectId, repositoryId } = await importFixture(token, 'Source Fixture');

    const first = await request(server())
      .post(`/api/v1/code-analysis/repositories/${repositoryId}/analyze`)
      .set('Authorization', `Bearer ${token}`)
      .send({ commitHash: 'aaa111' })
      .expect(201);
    expect(first.body.data.cached).toBe(false);
    expect(first.body.data.commitHash).toBe('aaa111');
    expect(first.body.data.summary).toMatchObject({
      fileCount: 3,
      parsedCount: 2,
      unsupportedCount: 1,
    });
    expect(first.body.data.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'src/app.ts',
          status: 'parsed',
          symbols: expect.arrayContaining([expect.objectContaining({ name: 'App' })]),
        }),
        expect.objectContaining({ path: 'notes.txt', status: 'unsupported' }),
      ]),
    );

    const second = await request(server())
      .post(`/api/v1/code-analysis/repositories/${repositoryId}/analyze`)
      .set('Authorization', `Bearer ${token}`)
      .send({ commitHash: 'aaa111' })
      .expect(201);
    expect(second.body.data.cached).toBe(true);
    expect(second.body.data.id).toBe(first.body.data.id);

    const latest = await request(server())
      .get(`/api/v1/code-analysis/projects/${projectId}/latest`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(latest.body.data.id).toBe(first.body.data.id);

    await request(server())
      .post(`/api/v1/code-analysis/repositories/${repositoryId}/analyze`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ commitHash: 'aaa111' })
      .expect(404);

    await request(server())
      .delete(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    expect(await connection.collection('analysisSnapshots').countDocuments({})).toBe(0);
  });

  it('builds evidence graphs from stored imports and compares analysed commits', async () => {
    activeFixture = GRAPH_FIXTURE;
    const token = await createUser('Graph Tester', `graph-owner-${Date.now()}@example.com`);
    const otherToken = await createUser('Graph Other', `graph-other-${Date.now()}@example.com`);
    const { projectId, repositoryId } = await importFixture(token, 'Graph Fixture');

    for (const commitHash of ['aaa111', 'bbb222']) {
      await request(server())
        .post(`/api/v1/code-analysis/repositories/${repositoryId}/analyze`)
        .set('Authorization', `Bearer ${token}`)
        .send({ commitHash })
        .expect(201);
    }

    const first = await request(server())
      .get(`/api/v1/projects/${projectId}/dependencies`)
      .query({ commitHash: 'aaa111' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(first.body.data.metrics).toMatchObject({
      fileCount: 2,
      edgeCount: 2,
      cycleCount: 1,
    });
    expect(first.body.data.edges[0].evidence[0]).toMatchObject({
      path: 'src/a.ts',
      importSource: './b',
    });

    const cycles = await request(server())
      .get(`/api/v1/projects/${projectId}/dependencies/cycles`)
      .query({ commitHash: 'aaa111' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(cycles.body.data).toHaveLength(1);
    expect(cycles.body.data[0].nodes).toEqual(['file:src/a.ts', 'file:src/b.ts']);

    const second = await request(server())
      .get(`/api/v1/repositories/${repositoryId}/dependencies`)
      .query({ commitHash: 'bbb222' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(second.body.data.metrics.cycleCount).toBe(0);
    expect(second.body.data.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: 'package:react', kind: 'package' }),
      ]),
    );

    const comparison = await request(server())
      .get(`/api/v1/projects/${projectId}/dependencies/compare`)
      .query({ from: 'aaa111', to: 'bbb222' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(comparison.body.data.removedEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'file:src/a.ts|file:src/b.ts|relative' }),
      ]),
    );
    expect(comparison.body.data.addedEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'file:src/a.ts|package:react|package' }),
      ]),
    );

    await request(server())
      .get(`/api/v1/projects/${projectId}/dependencies`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    await request(server())
      .get(`/api/v1/projects/${projectId}/dependencies`)
      .query({ commitHash: 'not-a-hash' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    await request(server())
      .delete(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    expect(await connection.collection('analysisSnapshots').countDocuments({})).toBe(0);
  });

  it('derives architecture claims and evolution from stored analysis', async () => {
    activeFixture = ARCHITECTURE_FIXTURE;
    const token = await createUser('Architecture Tester', `architecture-owner-${Date.now()}@example.com`);
    const otherToken = await createUser('Architecture Other', `architecture-other-${Date.now()}@example.com`);
    const { projectId, repositoryId } = await importFixture(token, 'Architecture Fixture');

    for (const commitHash of ['aaa111', 'bbb222']) {
      await request(server())
        .post(`/api/v1/code-analysis/repositories/${repositoryId}/analyze`)
        .set('Authorization', `Bearer ${token}`)
        .send({ commitHash })
        .expect(201);
    }

    const first = await request(server())
      .get(`/api/v1/projects/${projectId}/architecture`)
      .query({ commitHash: 'aaa111' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(first.body.data.commitHash).toBe('aaa111');
    expect(first.body.data.modules.map((module: { id: string }) => module.id)).toEqual(
      expect.arrayContaining([
        'module:src',
        'module:src/core',
        'module:src/api',
        'module:src/admin',
        'module:/',
      ]),
    );
    expect(first.body.data.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'framework:express', confidence: 'detected' }),
        expect.objectContaining({ id: 'deployment:Dockerfile', confidence: 'detected' }),
        expect.objectContaining({ id: 'microservice-inference', confidence: 'possible' }),
      ]),
    );
    const microservice = first.body.data.claims.find(
      (claim: { id: string }) => claim.id === 'microservice-inference',
    );
    expect(microservice.statement).toContain('No microservice architecture is claimed');
    expect(first.body.data.basis).toContain('No named architecture style');

    const repositoryView = await request(server())
      .get(`/api/v1/repositories/${repositoryId}/architecture`)
      .query({ commitHash: 'aaa111' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(repositoryView.body.data.commitHash).toBe('aaa111');

    const history = await request(server())
      .get(`/api/v1/projects/${projectId}/architecture/history`)
      .query({ from: 'aaa111', to: 'bbb222' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(history.body.data.removedClaims.map((claim: { id: string }) => claim.id)).toEqual(
      expect.arrayContaining(['deployment:Dockerfile', 'module:/']),
    );
    expect(history.body.data.basis).toContain('not that it did not exist historically');

    await request(server())
      .get(`/api/v1/projects/${projectId}/architecture`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    await request(server())
      .get(`/api/v1/projects/${projectId}/architecture`)
      .query({ commitHash: 'not-a-hash' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    await request(server())
      .delete(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    expect(await connection.collection('analysisSnapshots').countDocuments({})).toBe(0);
  });

  it('compares commits, structures, symbols, dependencies and side-by-side source text', async () => {
    activeFixture = COMPARISON_FIXTURE;
    const token = await createUser('Comparison Tester', `comparison-owner-${Date.now()}@example.com`);
    const otherToken = await createUser('Comparison Other', `comparison-other-${Date.now()}@example.com`);
    const { projectId, repositoryId } = await importFixture(token, 'Comparison Fixture');

    for (const commitHash of ['aaa111', 'bbb222']) {
      await request(server())
        .post(`/api/v1/code-analysis/repositories/${repositoryId}/analyze`)
        .set('Authorization', `Bearer ${token}`)
        .send({ commitHash })
        .expect(201);
    }

    const comparison = await request(server())
      .get(`/api/v1/projects/${projectId}/compare`)
      .query({ from: 'aaa111', to: 'bbb222' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(comparison.body.data).toMatchObject({
      fromCommitHash: 'aaa111',
      toCommitHash: 'bbb222',
    });
    expect(comparison.body.data.fileChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'M', path: 'src/app.ts' }),
        expect.objectContaining({ status: 'A', path: 'src/new.ts' }),
        expect.objectContaining({ status: 'D', path: 'src/legacy.ts' }),
      ]),
    );
    expect(comparison.body.data.structure).toMatchObject({
      addedPaths: ['src/new.ts'],
      removedPaths: ['src/legacy.ts'],
      retainedPathCount: 1,
    });
    expect(comparison.body.data.symbols.added).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'src/new.ts', name: 'added' }),
      ]),
    );
    expect(comparison.body.data.symbols.removed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'src/legacy.ts', name: 'old' }),
      ]),
    );
    expect(comparison.body.data.dependencies).toMatchObject({
      fromCommitHash: 'aaa111',
      toCommitHash: 'bbb222',
    });
    expect(comparison.body.data.basis).toContain('not that it never existed');
    expect(comparison.body.data.limits).toEqual([]);

    const repositoryComparison = await request(server())
      .get(`/api/v1/repositories/${repositoryId}/compare`)
      .query({ fromCommit: 'aaa111', toCommit: 'bbb222' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(repositoryComparison.body.data.fromCommitHash).toBe('aaa111');

    const fileDiff = await request(server())
      .get(`/api/v1/projects/${projectId}/compare/files`)
      .query({ from: 'aaa111', to: 'bbb222', path: 'src/app.ts' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(fileDiff.body.data).toMatchObject({
      path: 'src/app.ts',
      fromExists: true,
      toExists: true,
      truncated: false,
    });
    expect(fileDiff.body.data.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'changed', left: 'export const version = 1;', right: 'export const version = 2;' }),
      ]),
    );

    const deletedDiff = await request(server())
      .get(`/api/v1/repositories/${repositoryId}/compare/files`)
      .query({ fromCommit: 'aaa111', toCommit: 'bbb222', path: 'src/legacy.ts' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(deletedDiff.body.data).toMatchObject({ fromExists: true, toExists: false });
    expect(deletedDiff.body.data.rows.every((row: { kind: string }) => row.kind === 'removed')).toBe(true);

    await request(server())
      .get(`/api/v1/projects/${projectId}/compare`)
      .query({ from: 'aaa111', to: 'bbb222' })
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    await request(server())
      .get(`/api/v1/projects/${projectId}/compare/files`)
      .query({ from: 'aaa111', to: 'bbb222', path: '../secret.txt' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    await request(server())
      .get(`/api/v1/projects/${projectId}/compare`)
      .query({ from: 'not-a-hash', to: 'bbb222' })
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    await request(server())
      .delete(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    expect(await connection.collection('analysisSnapshots').countDocuments({})).toBe(0);
  });

  it('runs the evidence-grounded assistant only with consent and persists owner-scoped conversations', async () => {
    activeFixture = SOURCE_FIXTURE;
    const token = await createUser('AI Owner', `ai-owner-${Date.now()}@example.com`);
    const otherToken = await createUser('AI Other', `ai-other-${Date.now()}@example.com`);
    const { projectId, repositoryId } = await importFixture(token, 'AI Fixture');
    await request(server())
      .post(`/api/v1/code-analysis/repositories/${repositoryId}/analyze`)
      .set('Authorization', `Bearer ${token}`)
      .send({ commitHash: 'aaa111' })
      .expect(201);

    ollamaEnabled = false;
    const disabledStatus = await request(server())
      .get(`/api/v1/projects/${projectId}/ai/status`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(disabledStatus.body.data).toMatchObject({ enabled: false, model: 'test-local-model' });
    expect(disabledStatus.body.data.basis).toContain('disabled by default');

    await request(server())
      .post(`/api/v1/projects/${projectId}/ai/chat`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'What changed?', consent: true })
      .expect(503);

    ollamaEnabled = true;
    await request(server())
      .post(`/api/v1/projects/${projectId}/ai/chat`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'What changed?', consent: false })
      .expect(400);

    const chat = await request(server())
      .post(`/api/v1/projects/${projectId}/ai/chat`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'What changed?', consent: true })
      .expect(201);
    const conversationId: string = chat.body.data.conversationId;
    expect(chat.body.data.model).toBe('test-local-model');
    expect(chat.body.data.evidence).toHaveLength(1);
    expect(chat.body.data.basis).toContain('No raw source text');
    expect(ollamaStub.generate).toHaveBeenCalledWith(
      expect.stringContaining('[EVIDENCE id='),
    );

    const conversation = await request(server())
      .get(`/api/v1/ai/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(conversation.body.data.messages.map((message: { role: string }) => message.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(conversation.body.data.messages[1].evidenceIds).toHaveLength(1);

    const list = await request(server())
      .get(`/api/v1/projects/${projectId}/ai/conversations`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body.meta.total).toBe(1);

    await request(server())
      .get(`/api/v1/ai/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    const appended = await request(server())
      .post(`/api/v1/projects/${projectId}/ai/chat`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'And now?', consent: true, conversationId })
      .expect(201);
    expect(appended.body.data.conversationId).toBe(conversationId);

    await request(server())
      .delete(`/api/v1/ai/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
    await request(server())
      .get(`/api/v1/ai/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('generates cited reports from stored evidence and deletes them with the project', async () => {
    activeFixture = SOURCE_FIXTURE;
    const token = await createUser('Report Owner', `report-owner-${Date.now()}@example.com`);
    const otherToken = await createUser('Report Other', `report-other-${Date.now()}@example.com`);
    const { projectId, repositoryId } = await importFixture(token, 'Report Fixture');
    await request(server())
      .post(`/api/v1/code-analysis/repositories/${repositoryId}/analyze`)
      .set('Authorization', `Bearer ${token}`)
      .send({ commitHash: 'aaa111' })
      .expect(201);

    const generated = await request(server())
      .post(`/api/v1/projects/${projectId}/reports`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    const reportId: string = generated.body.data.id;
    expect(generated.body.data).toMatchObject({ format: 'markdown', title: 'Project report: Report Fixture' });
    expect(generated.body.data.content).toContain('## Repository evidence');
    expect(generated.body.data.basis).toContain('owner-scoped');
    expect(generated.body.data.evidenceIds.length).toBeGreaterThan(0);
    expect(generated.body.data.content).not.toContain("return 'ok'");

    const list = await request(server())
      .get(`/api/v1/projects/${projectId}/reports`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body.meta.total).toBe(1);

    const fetched = await request(server())
      .get(`/api/v1/reports/${reportId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(fetched.body.data.content).toBe(generated.body.data.content);

    await request(server())
      .get(`/api/v1/reports/${reportId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    const removable = await request(server())
      .post(`/api/v1/projects/${projectId}/reports`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    await request(server())
      .delete(`/api/v1/reports/${removable.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
    await request(server())
      .get(`/api/v1/reports/${removable.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    const chat = await request(server())
      .post(`/api/v1/projects/${projectId}/ai/chat`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Summarise the evidence', consent: true })
      .expect(201);

    await request(server())
      .delete(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    expect(
      await connection
        .collection('reports')
        .countDocuments({ projectId: new Types.ObjectId(projectId) }),
    ).toBe(0);
    expect(
      await connection
        .collection('aiConversations')
        .countDocuments({ projectId: new Types.ObjectId(projectId) }),
    ).toBe(0);

    await request(server())
      .get(`/api/v1/reports/${reportId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    await request(server())
      .get(`/api/v1/ai/conversations/${chat.body.data.conversationId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
