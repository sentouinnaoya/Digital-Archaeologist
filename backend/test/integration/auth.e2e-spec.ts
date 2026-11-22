import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';

describe('Authentication (integration)', () => {
  let app: INestApplication;
  let connection: Connection;
  const email = `auth-${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
    connection = moduleRef.get<Connection>(getConnectionToken());
  });

  afterAll(async () => {
    if (connection) await connection.dropDatabase();
    if (app) await app.close();
  });

  it('registers, authenticates, refreshes and logs out a user', async () => {
    const agent = request.agent(app.getHttpServer());

    const registered = await agent
      .post('/api/v1/auth/register')
      .send({ fullName: 'Grace Hopper', email, password: 'compiler123' })
      .expect(201);

    expect(registered.body.data.user.email).toBe(email);
    expect(registered.body.data.user).not.toHaveProperty('passwordHash');
    const accessToken: string = registered.body.data.accessToken;
    expect(accessToken.split('.')).toHaveLength(3);

    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(me.body.data.email).toBe(email);

    const refreshed = await agent.post('/api/v1/auth/refresh').expect(200);
    expect(refreshed.body.data.accessToken).toBeDefined();

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    await agent.post('/api/v1/auth/refresh').expect(401);
  });

  it('rejects weak passwords and duplicate registrations', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ fullName: 'No Digits', email: `weak-${Date.now()}@example.com`, password: 'onlyletters' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ fullName: 'Duplicate', email, password: 'compiler123' })
      .expect(409);
  });
});
