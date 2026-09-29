import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module.js';
import { prisma } from '../src/lib/prisma.js';

describe('Merchant create event', () => {
  let app: INestApplication<App>;

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const testEmailPrefix = `events-e2e-${runId}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await prisma.event.deleteMany({
      where: {
        organizer: {
          email: {
            startsWith: testEmailPrefix,
          },
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: testEmailPrefix,
        },
      },
    });
    await app.close();
  });

  it('creates a draft event for the authenticated merchant', async () => {
    const merchant = await signUpAs('merchant');

    const response = await request(app.getHttpServer())
      .post('/events')
      .set('Cookie', merchant.cookie)
      .send({
        name: 'ChainPass Hackathon 2026',
        description: 'Internal hackathon',
        location: 'Beijing',
        startsAt: '2026-10-10T01:00:00.000Z',
        endsAt: '2026-10-10T09:00:00.000Z',
        coverImageUrl: 'https://example.com/chainpass.png',
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: 'ChainPass Hackathon 2026',
      status: 'DRAFT',
      organizerId: merchant.userId,
    });
    expect(response.body.id).toEqual(expect.any(String));

    const storedEvent = await prisma.event.findUnique({
      where: { id: response.body.id as string },
    });
    expect(storedEvent?.organizerId).toBe(merchant.userId);
  });

  it('forbids a normal user from creating an event', async () => {
    const user = await signUpAs('user');

    await request(app.getHttpServer())
      .post('/events')
      .set('Cookie', user.cookie)
      .send({
        name: 'Forbidden event',
        startsAt: '2026-10-10T01:00:00.000Z',
        endsAt: '2026-10-10T09:00:00.000Z',
      })
      .expect(403);
  });

  it('allows an admin to create an event', async () => {
    const admin = await signUpAs('admin');

    const response = await request(app.getHttpServer())
      .post('/events')
      .set('Cookie', admin.cookie)
      .send({
        name: 'Admin-created event',
        startsAt: '2026-10-11T01:00:00.000Z',
        endsAt: '2026-10-11T09:00:00.000Z',
      });

    expect(response.status).toBe(201);
    expect(response.body.organizerId).toBe(admin.userId);
  });

  it('rejects an anonymous event creation request', async () => {
    await request(app.getHttpServer())
      .post('/events')
      .send({
        name: 'Anonymous event',
        startsAt: '2026-10-10T01:00:00.000Z',
        endsAt: '2026-10-10T09:00:00.000Z',
      })
      .expect(401);
  });

  it('rejects an event that ends before it starts', async () => {
    const merchant = await signUpAs('merchant', 'invalid-dates');

    const response = await request(app.getHttpServer())
      .post('/events')
      .set('Cookie', merchant.cookie)
      .send({
        name: 'Invalid event',
        startsAt: '2026-10-10T09:00:00.000Z',
        endsAt: '2026-10-10T01:00:00.000Z',
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
    });
  });

  it('rejects a client-supplied organizer identity', async () => {
    const merchant = await signUpAs('merchant', 'spoofed-organizer');

    const response = await request(app.getHttpServer())
      .post('/events')
      .set('Cookie', merchant.cookie)
      .send({
        name: 'Spoofed organizer event',
        startsAt: '2026-10-10T01:00:00.000Z',
        endsAt: '2026-10-10T09:00:00.000Z',
        organizerId: 'client-controlled-user-id',
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  async function signUpAs(
    role: 'admin' | 'merchant' | 'user',
    label = 'default',
  ) {
    const email = `${testEmailPrefix}-${role}-${label}@chainpass.local`;
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', 'http://localhost:3000')
      .send({
        name: `${role} test user`,
        email,
        password: 'ChainPass123!',
      })
      .expect(200);

    const userId = response.body.user.id as string;
    await prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    const cookieHeader = response.headers['set-cookie'];
    const cookie = Array.isArray(cookieHeader)
      ? cookieHeader.map((value) => value.split(';')[0]).join('; ')
      : cookieHeader;

    if (!cookie) {
      throw new Error('Better Auth did not return a session cookie');
    }

    return { cookie, userId };
  }
});
