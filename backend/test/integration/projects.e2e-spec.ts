import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';

describe('Projects (integration)', () => {
  let app: INestApplication;
  let connection: Connection;
  let ownerToken: string;
  let otherToken: string;

  const register = async (prefix: string): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: `${prefix} User`,
        email: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
        password: 'project123',
      })
      .expect(201);
    return response.body.data.accessToken as string;
  };

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
    connection = moduleRef.get<Connection>(getConnectionToken());
    ownerToken = await register('owner');
    otherToken = await register('other');
  });

  afterAll(async () => {
    if (connection) await connection.dropDatabase();
    if (app) await app.close();
  });

  it('creates, lists, updates and deletes an owned project', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set(auth(ownerToken))
      .send({ name: 'Archaeology Demo', description: 'A test project' })
      .expect(201);

    const projectId = created.body.data.id as string;
    expect(created.body.data.analysisStatus).toBe('not_started');

    const listed = await request(app.getHttpServer())
      .get('/api/v1/projects?page=1&limit=10')
      .set(auth(ownerToken))
      .expect(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });

    const fetched = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}`)
      .set(auth(ownerToken))
      .expect(200);
    expect(fetched.body.data.name).toBe('Archaeology Demo');

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${projectId}`)
      .set(auth(ownerToken))
      .send({ description: 'Updated description' })
      .expect(200);
    expect(updated.body.data.description).toBe('Updated description');

    await request(app.getHttpServer())
      .delete(`/api/v1/projects/${projectId}`)
      .set(auth(ownerToken))
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}`)
      .set(auth(ownerToken))
      .expect(404);
  });

  it('prevents cross-user access to projects', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set(auth(ownerToken))
      .send({ name: 'Private Project' })
      .expect(201);
    const projectId = created.body.data.id as string;

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}`)
      .set(auth(otherToken))
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${projectId}`)
      .set(auth(otherToken))
      .send({ name: 'Hijacked' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/projects/${projectId}`)
      .set(auth(otherToken))
      .expect(404);

    const otherList = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set(auth(otherToken))
      .expect(200);
    expect(otherList.body.data).toHaveLength(0);

    await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set(auth(ownerToken))
      .send({ name: 'x' })
      .expect(400);
  });
});
