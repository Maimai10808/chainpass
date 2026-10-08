import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module.js';
import { prisma } from '../src/database/prisma.js';

describe('Merchant create event', () => {
  let app: INestApplication<App>;

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const testEmailPrefix = `events-e2e-${runId}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
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

  it('returns an event by id to its merchant organizer', async () => {
    const merchant = await signUpAs('merchant', 'event-detail');
    const created = await request(app.getHttpServer())
      .post('/events')
      .set('Cookie', merchant.cookie)
      .send({
        name: 'Event management detail',
        startsAt: '2026-10-12T01:00:00.000Z',
        endsAt: '2026-10-12T09:00:00.000Z',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/events/${created.body.id as string}/manage`)
      .set('Cookie', merchant.cookie);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: created.body.id,
      name: 'Event management detail',
      status: 'DRAFT',
      organizerId: merchant.userId,
    });
  });

  it('lists only the merchant own draft and published events with minimal organizer data', async () => {
    const merchant = await signUpAs('merchant', 'own-list');
    const other = await signUpAs('merchant', 'other-list');
    const draft = await createEvent(merchant.cookie, 'Own draft');
    const published = await createEvent(merchant.cookie, 'Own published');
    const foreign = await createEvent(other.cookie, 'Private foreign draft');
    await request(app.getHttpServer())
      .post(`/events/${published.id}/ticket-types`)
      .set('Cookie', merchant.cookie)
      .send({ name: 'General', totalSupply: 2, price: 0 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/events/${published.id}/publish`)
      .set('Cookie', merchant.cookie)
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/events/mine')
      .set('Cookie', merchant.cookie)
      .expect(200);
    expect(
      response.body.map((event: { id: string }) => event.id).sort(),
    ).toEqual([draft.id, published.id].sort());
    expect(response.body).not.toContainEqual(
      expect.objectContaining({ id: foreign.id }),
    );
    expect(response.body).toContainEqual(
      expect.objectContaining({
        id: draft.id,
        status: 'DRAFT',
        ticketTypeCount: 0,
        organizer: { id: merchant.userId, name: 'merchant test user' },
      }),
    );
    expect(response.body).toContainEqual(
      expect.objectContaining({
        id: published.id,
        status: 'PUBLISHED',
        ticketTypeCount: 1,
      }),
    );
    expect(Object.keys(response.body[0].organizer).sort()).toEqual([
      'id',
      'name',
    ]);

    const publicList = await request(app.getHttpServer())
      .get('/events')
      .expect(200);
    expect(publicList.body).not.toContainEqual(
      expect.objectContaining({ id: draft.id }),
    );
    expect(publicList.body).not.toContainEqual(
      expect.objectContaining({ id: foreign.id }),
    );
    const publicDetail = await request(app.getHttpServer())
      .get(`/events/${published.id}`)
      .expect(200);
    expect(publicDetail.body.organizer).toEqual({ name: 'merchant test user' });
    await request(app.getHttpServer()).get(`/events/${draft.id}`).expect(404);
  });

  it('allows only admin to list all platform drafts and published events', async () => {
    const admin = await signUpAs('admin', 'platform-list');
    const merchant = await signUpAs('merchant', 'platform-list');
    const mine = await createEvent(admin.cookie, 'Admin draft');
    const foreign = await createEvent(merchant.cookie, 'Merchant draft');
    const response = await request(app.getHttpServer())
      .get('/events/admin')
      .set('Cookie', admin.cookie)
      .expect(200);
    expect(response.body).toContainEqual(
      expect.objectContaining({ id: mine.id }),
    );
    expect(response.body).toContainEqual(
      expect.objectContaining({
        id: foreign.id,
        status: 'DRAFT',
        organizerId: merchant.userId,
      }),
    );
    const own = await request(app.getHttpServer())
      .get('/events/mine')
      .set('Cookie', admin.cookie)
      .expect(200);
    expect(own.body.map((event: { id: string }) => event.id)).toEqual([
      mine.id,
    ]);
    await request(app.getHttpServer())
      .get('/events/admin')
      .set('Cookie', merchant.cookie)
      .expect(403);
  });

  it('rejects normal users on both management lists despite public event read permission', async () => {
    const user = await signUpAs('user', 'list-forbidden');
    await request(app.getHttpServer())
      .get('/events/mine')
      .set('Cookie', user.cookie)
      .expect(403);
    const response = await request(app.getHttpServer())
      .get('/events/admin')
      .set('Cookie', user.cookie)
      .expect(403);
    expect(response.body.code).toBe('EVENT_LIST_FORBIDDEN');
  });

  it('rejects anonymous requests to both management lists', async () => {
    await request(app.getHttpServer()).get('/events/mine').expect(401);
    await request(app.getHttpServer()).get('/events/admin').expect(401);
  });

  it('promotes a user through the Better Auth admin API, not through registration', async () => {
    const registration = {
      name: 'Registration remains user',
      email: `${testEmailPrefix}-registration@chainpass.local`,
      password: 'ChainPass123!',
    };
    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', 'http://localhost:3000')
      .send({ ...registration, role: 'admin' })
      .expect(400);
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', 'http://localhost:3000')
      .send(registration)
      .expect(200);
    expect(response.body.user.role).toBe('user');
    const userId = response.body.user.id as string;
    const admin = await signUpAs('admin', 'promotion');
    const ordinary = await signUpAs('user', 'promotion');
    await request(app.getHttpServer())
      .post('/api/auth/admin/set-role')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', ordinary.cookie)
      .send({ userId, role: 'merchant' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/auth/admin/set-role')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', admin.cookie)
      .send({ userId, role: 'merchant' })
      .expect(200);
    expect(
      (await prisma.user.findUnique({ where: { id: userId } }))?.role,
    ).toBe('merchant');
    const listed = await request(app.getHttpServer())
      .get('/api/auth/admin/list-users')
      .query({
        searchField: 'email',
        searchOperator: 'contains',
        searchValue: `${testEmailPrefix}-registration`,
      })
      .set('Cookie', admin.cookie)
      .expect(200);
    expect(listed.body.users).toContainEqual(
      expect.objectContaining({ id: userId, role: 'merchant' }),
    );
    await request(app.getHttpServer())
      .get('/api/auth/admin/list-users')
      .set('Cookie', ordinary.cookie)
      .expect(403);
  });

  async function createEvent(
    cookie: string,
    name: string,
  ): Promise<{ id: string }> {
    const response = await request(app.getHttpServer())
      .post('/events')
      .set('Cookie', cookie)
      .send({
        name,
        accessMode: 'PUBLIC',
        startsAt: '2026-11-10T01:00:00.000Z',
        endsAt: '2026-11-10T09:00:00.000Z',
      })
      .expect(201);
    return response.body as { id: string };
  }

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
