import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET) requires an authenticated session', () => {
    return request(app.getHttpServer()).get('/').expect(401);
  });

  it('/health (GET) reports API and database readiness anonymously', () => {
    return request(app.getHttpServer()).get('/health').expect(200, {
      status: 'ok',
      database: 'connected',
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
