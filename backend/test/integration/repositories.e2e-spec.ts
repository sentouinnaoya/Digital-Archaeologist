import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Test } from '@nestjs/testing';
import { Connection, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';
import type { ParsedGitCommit } from '../../src/modules/repositories/git-log.parser';
import { GitService, type GitMetadata } from '../../src/modules/repositories/git.service';
import { RemoteUrlValidator } from '../../src/modules/repositories/remote-url.validator';

const commits: ParsedGitCommit[] = [
  {
    hash: 'aaa111',
    authorName: 'Ada Lovelace',
    authorEmail: 'ada@example.com',
    authoredAt: '2026-01-01T00:00:00.000Z',
    committedAt: '2026-01-01T00:00:00.000Z',
    parentHashes: [],
    message: 'Initial implementation',
    fileChanges: [{ status: 'A', path: 'src/index.ts' }],
  },
  {
    hash: 'bbb222',
    authorName: 'Grace Hopper',
    authorEmail: 'grace@example.com',
    authoredAt: '2026-01-02T00:00:00.000Z',
    committedAt: '2026-01-02T00:00:00.000Z',
    parentHashes: ['aaa111'],
    message: 'Add compiler module',
    fileChanges: [
      { status: 'A', path: 'src/compiler.ts' },
      { status: 'M', path: 'src/index.ts' },
    ],
  },
];

const metadata: GitMetadata = {
  branches: ['feature/parser', 'main'],
  tags: ['v0.1.0'],
  headCommitHash: 'bbb222',
  totalCommitCount: 2,
};

describe('Repositories (integration)', () => {
  let app: INestApplication;
  let connection: Connection;
  let storageRoot: string;
  const server = () => app.getHttpServer();
  const gitStub = {
    clone: jest.fn(async (_url: string, target: string) => {
      await mkdir(target, { recursive: true });
      await writeFile(
        resolve(target, 'LICENSE'),
        'MIT License\nPermission is hereby granted, free of charge, to any person obtaining a copy.',
      );
      await writeFile(resolve(target, 'README.md'), 'Fixture repository');
    }),
    readMetadata: jest.fn(async () => metadata),
    readCommits: jest.fn(async () => commits),
  };
  const validatorStub = {
    validate: jest.fn(async (url: string) => url),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GitService)
      .useValue(gitStub)
      .overrideProvider(RemoteUrlValidator)
      .useValue(validatorStub)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
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

  async function createUser(email: string): Promise<string> {
    const response = await request(server())
      .post('/api/v1/auth/register')
      .send({ fullName: 'Integration Tester', email, password: 'testing123' })
      .expect(201);
    return response.body.data.accessToken;
  }

  async function createProject(token: string, name: string): Promise<string> {
    const response = await request(server())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name })
      .expect(201);
    return response.body.data.id;
  }

  async function waitForJob(token: string, projectId: string) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const response = await request(server())
        .get(`/api/v1/repositories/projects/${projectId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const status = response.body.data;
      if (status.repository.status === 'ready' && status.job.status === 'completed') {
        return status;
      }
      if (status.job.status === 'failed') {
        throw new Error(`Analysis job failed: ${status.job.error}`);
      }
      await new Promise((done) => setTimeout(done, 100));
    }
    throw new Error('Timed out waiting for analysis job');
  }

  it('imports a repository, exposes real Git history and enforces ownership', async () => {
    const token = await createUser(`repo-owner-${Date.now()}@example.com`);
    const otherToken = await createUser(`repo-other-${Date.now()}@example.com`);
    const projectId = await createProject(token, 'Repository Integration');

    await request(server())
      .post('/api/v1/repositories/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ projectId, repositoryUrl: 'http://example.com/repo.git' })
      .expect(400);

    const imported = await request(server())
      .post('/api/v1/repositories/import')
      .set('Authorization', `Bearer ${token}`)
      .send({
        projectId,
        repositoryUrl: 'https://github.com/example/repository.git',
        defaultBranch: 'main',
      })
      .expect(202);

    const repositoryId = imported.body.data.repository.id;
    expect(imported.body.data.repository.status).toBe('importing');
    expect(imported.body.data.job.status).toBe('queued');

    const status = await waitForJob(token, projectId);
    expect(status.repository).toMatchObject({
      id: repositoryId,
      status: 'ready',
      repositoryUrl: 'https://github.com/example/repository.git',
      headCommitHash: 'bbb222',
      totalCommitCount: 2,
      analyzedCommitCount: 2,
    });
    expect(status.repository.license).toMatchObject({
      identifier: 'MIT',
      confidence: 'detected',
      path: 'LICENSE',
    });
    expect(status.repository.branches).toEqual(['feature/parser', 'main']);
    expect(status.repository.tags).toEqual(['v0.1.0']);
    expect(status.repository.detectedLanguages).toContain('TypeScript');
    expect(status.job.steps.map((step: { name: string }) => step.name)).toContain('commits');
    expect(gitStub.clone).toHaveBeenCalledWith(
      'https://github.com/example/repository.git',
      expect.stringContaining(repositoryId),
    );

    const history = await request(server())
      .get(`/api/v1/repositories/projects/${projectId}/commits`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(history.body.data).toHaveLength(2);
    expect(history.body.data[0]).toMatchObject({
      hash: 'bbb222',
      message: 'Add compiler module',
      fileChanges: [
        { status: 'A', path: 'src/compiler.ts' },
        { status: 'M', path: 'src/index.ts' },
      ],
    });

    const contributors = await request(server())
      .get(`/api/v1/repositories/projects/${projectId}/contributors`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(contributors.body.data).toEqual([
      expect.objectContaining({ email: 'ada@example.com', commitCount: 1 }),
      expect.objectContaining({ email: 'grace@example.com', commitCount: 1 }),
    ]);

    await request(server())
      .get(`/api/v1/repositories/projects/${projectId}/branches`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((response) => expect(response.body.data).toContain('main'));

    await request(server())
      .get(`/api/v1/repositories/${repositoryId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    const reanalysis = await request(server())
      .post(`/api/v1/repositories/${repositoryId}/analyze`)
      .set('Authorization', `Bearer ${token}`)
      .expect(202);
    expect(reanalysis.body.data.type).toBe('reanalyze');

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const job = await request(server())
        .get(`/api/v1/repositories/${repositoryId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      if (job.body.data.job.id === reanalysis.body.data.id && job.body.data.job.status === 'completed') {
        break;
      }
      await new Promise((done) => setTimeout(done, 100));
    }
    expect(gitStub.readCommits).toHaveBeenCalledTimes(2);

    const project = await request(server())
      .get(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(project.body.data.analysisStatus).toBe('completed');

    const localPath = resolve(storageRoot, projectId, repositoryId);
    await request(server())
      .delete(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    expect(
      await connection.collection('repositories').countDocuments({ _id: new Types.ObjectId(repositoryId) }),
    ).toBe(0);
    expect(
      await connection.collection('commits').countDocuments({ repositoryId: new Types.ObjectId(repositoryId) }),
    ).toBe(0);
    await expect(access(localPath)).rejects.toThrow();
  });
});
