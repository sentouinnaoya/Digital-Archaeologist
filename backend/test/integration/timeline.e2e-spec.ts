import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Test } from '@nestjs/testing';
import { Connection } from 'mongoose';
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
  branches: ['main'],
  tags: [],
  headCommitHash: 'bbb222',
  totalCommitCount: 2,
};

describe('Timeline (integration)', () => {
  let app: INestApplication;
  let connection: Connection;
  let storageRoot: string;
  const server = () => app.getHttpServer();
  const gitStub = {
    clone: jest.fn(async (_url: string, target: string) => {
      await mkdir(target, { recursive: true });
      await writeFile(resolve(target, 'README.md'), 'Fixture repository');
    }),
    readMetadata: jest.fn(async () => metadata),
    readCommits: jest.fn(async () => commits),
  };
  const validatorStub = { validate: jest.fn(async (url: string) => url) };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GitService)
      .useValue(gitStub)
      .overrideProvider(RemoteUrlValidator)
      .useValue(validatorStub)
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

  async function createUser(email: string): Promise<string> {
    const response = await request(server())
      .post('/api/v1/auth/register')
      .send({ fullName: 'Timeline Tester', email, password: 'testing123' })
      .expect(201);
    return response.body.data.accessToken;
  }

  async function importFixture(token: string): Promise<string> {
    const project = await request(server())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Timeline Fixture' })
      .expect(201);
    const projectId = project.body.data.id;

    await request(server())
      .post('/api/v1/repositories/import')
      .set('Authorization', `Bearer ${token}`)
      .send({ projectId, repositoryUrl: 'https://github.com/example/repository.git' })
      .expect(202);

    for (let attempt = 0; attempt < 100; attempt += 1) {
      const status = await request(server())
        .get(`/api/v1/repositories/projects/${projectId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      if (status.body.data.job.status === 'completed') return projectId;
      if (status.body.data.job.status === 'failed') {
        throw new Error(status.body.data.job.error);
      }
      await new Promise((done) => setTimeout(done, 100));
    }
    throw new Error('Timed out waiting for import');
  }

  it('exposes filtered evidence-linked events and a reconstructed structure', async () => {
    const token = await createUser(`timeline-owner-${Date.now()}@example.com`);
    const otherToken = await createUser(`timeline-other-${Date.now()}@example.com`);
    const projectId = await importFixture(token);

    const all = await request(server())
      .get(`/api/v1/projects/${projectId}/timeline`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(all.body.meta.total).toBe(5); // 2 commits + 3 file changes
    expect(all.body.data[0]).toMatchObject({
      type: 'commit',
      confidence: 'detected',
      commitHash: 'bbb222',
      contributorEmail: 'grace@example.com',
    });
    expect(all.body.data[0].evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'file', path: 'src/compiler.ts' }),
      ]),
    );

    const added = await request(server())
      .get(`/api/v1/projects/${projectId}/timeline`)
      .query({ type: 'file_added' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(added.body.meta.total).toBe(2);

    const contributor = await request(server())
      .get(`/api/v1/projects/${projectId}/timeline`)
      .query({ contributor: 'ada@example.com' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(contributor.body.meta.total).toBe(2);

    const dated = await request(server())
      .get(`/api/v1/projects/${projectId}/timeline`)
      .query({ from: '2026-01-02T00:00:00.000Z' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(dated.body.meta.total).toBe(3);

    const eventId = all.body.data[0].id;
    const detail = await request(server())
      .get(`/api/v1/projects/${projectId}/timeline/${eventId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body.data.id).toBe(eventId);

    const structure = await request(server())
      .get(`/api/v1/projects/${projectId}/structure`)
      .query({ at: 'bbb222' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(structure.body.data).toMatchObject({
      atCommitHash: 'bbb222',
      analyzedCommitCount: 2,
      fileCount: 2,
      confidence: 'detected',
    });
    expect(structure.body.data.root.children[0].children.map((node: { path: string }) => node.path)).toEqual([
      'src/compiler.ts',
      'src/index.ts',
    ]);

    await request(server())
      .get(`/api/v1/projects/${projectId}/timeline/${eventId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    const hidden = await request(server())
      .get(`/api/v1/projects/${projectId}/timeline`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);
    expect(hidden.body.meta.total).toBe(0);

    await request(server())
      .delete(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    expect(await connection.collection('timelineEvents').countDocuments({})).toBe(0);
  });
});
