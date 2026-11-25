import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import { access, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Test } from '@nestjs/testing';
import { Connection, Types } from 'mongoose';
import { strToU8, zipSync } from 'fflate';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';

describe('Snapshot import (integration)', () => {
  let app: INestApplication;
  let connection: Connection;
  let storageRoot: string;
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
      .send({ fullName: 'Snapshot Tester', email, password: 'testing123' })
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

  it('imports a ZIP snapshot without fabricating Git history', async () => {
    const token = await createUser(`snapshot-${Date.now()}@example.com`);
    const otherToken = await createUser(`snapshot-other-${Date.now()}@example.com`);
    const projectId = await createProject(token, 'Snapshot Project');
    const archive = Buffer.from(
      zipSync({
        'src/app.ts': strToU8('export const app = true;\n'),
        'docs/README.md': strToU8('# Snapshot evidence\n'),
      }),
    );

    const imported = await request(server())
      .post(`/api/v1/projects/${projectId}/snapshots/import`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', archive, 'legacy-snapshot.zip')
      .expect(202);

    expect(imported.body.data.repository).toMatchObject({
      sourceType: 'zip',
      snapshotName: 'legacy-snapshot.zip',
      repositoryUrl: null,
      status: 'importing',
    });
    expect(imported.body.data.job.status).toBe('queued');

    let status: any;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const response = await request(server())
        .get(`/api/v1/repositories/projects/${projectId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      status = response.body.data;
      if (status.job.status === 'completed') break;
      if (status.job.status === 'failed') throw new Error(status.job.error);
      await new Promise((done) => setTimeout(done, 100));
    }

    expect(status.repository).toMatchObject({
      sourceType: 'zip',
      status: 'ready',
      snapshotFileCount: 2,
      headCommitHash: null,
      totalCommitCount: 0,
      analyzedCommitCount: 0,
    });
    expect(status.repository.detectedLanguages).toContain('TypeScript');
    expect(status.job.steps.map((step: { name: string }) => step.name)).toContain('extract');

    const files = await request(server())
      .get(`/api/v1/repositories/projects/${projectId}/files`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(files.body.data).toEqual([
      expect.objectContaining({ path: 'docs/README.md', language: 'Markdown' }),
      expect.objectContaining({ path: 'src/app.ts', language: 'TypeScript' }),
    ]);

    const commits = await request(server())
      .get(`/api/v1/repositories/projects/${projectId}/commits`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(commits.body.data).toEqual([]);
    expect(commits.body.meta.total).toBe(0);

    await request(server())
      .get(`/api/v1/repositories/projects/${projectId}/files`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    const localPath = resolve(
      storageRoot,
      projectId,
      imported.body.data.repository.id,
    );
    await request(server())
      .delete(`/api/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    expect(
      await connection.collection('snapshotFiles').countDocuments({
        repositoryId: new Types.ObjectId(imported.body.data.repository.id),
      }),
    ).toBe(0);
    await expect(access(localPath)).rejects.toThrow();
  });

  it('rejects non-ZIP uploads', async () => {
    const token = await createUser(`snapshot-invalid-${Date.now()}@example.com`);
    const projectId = await createProject(token, 'Invalid Snapshot');
    const archive = Buffer.from(strToU8('not a zip'));

    await request(server())
      .post(`/api/v1/projects/${projectId}/snapshots/import`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', archive, 'notes.txt')
      .expect(400);
  });
});
