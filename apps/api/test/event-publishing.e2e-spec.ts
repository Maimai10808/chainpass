import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module.js';
import { prisma } from '../src/lib/prisma.js';

describe('Event publishing and public discovery', () => {
  let app: INestApplication<App>;

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const testEmailPrefix = `event-publishing-e2e-${runId}`;

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

  it('publishes a merchant-owned draft with an active ticket type', async () => {
    const merchant = await signUpAs('merchant');
    const event = await createEventFor(merchant.userId);
    await createTicketTypeFor(event.id);

    const response = await request(app.getHttpServer())
      .post(`/events/${event.id}/publish`)
      .set('Cookie', merchant.cookie);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: event.id,
      organizerId: merchant.userId,
      status: 'PUBLISHED',
    });

    const storedEvent = await prisma.event.findUnique({
      where: { id: event.id },
    });
    expect(storedEvent?.status).toBe('PUBLISHED');
  });

  it('forbids a merchant from publishing another merchant event', async () => {
    const owner = await signUpAs('merchant');
    const otherMerchant = await signUpAs('merchant');
    const event = await createEventFor(owner.userId);
    await createTicketTypeFor(event.id);

    const response = await request(app.getHttpServer())
      .post(`/events/${event.id}/publish`)
      .set('Cookie', otherMerchant.cookie);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      code: 'EVENT_OWNERSHIP_REQUIRED',
      message: 'Only the event organizer can publish this event',
    });
  });

  it('allows an admin to publish any event', async () => {
    const owner = await signUpAs('merchant');
    const admin = await signUpAs('admin');
    const event = await createEventFor(owner.userId);
    await createTicketTypeFor(event.id);

    const response = await request(app.getHttpServer())
      .post(`/events/${event.id}/publish`)
      .set('Cookie', admin.cookie);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('PUBLISHED');
  });

  it('forbids a normal user from publishing an event', async () => {
    const owner = await signUpAs('merchant');
    const user = await signUpAs('user');
    const event = await createEventFor(owner.userId);
    await createTicketTypeFor(event.id);

    await request(app.getHttpServer())
      .post(`/events/${event.id}/publish`)
      .set('Cookie', user.cookie)
      .expect(403);
  });

  it('rejects anonymous publishing', async () => {
    const owner = await signUpAs('merchant');
    const event = await createEventFor(owner.userId);
    await createTicketTypeFor(event.id);

    await request(app.getHttpServer())
      .post(`/events/${event.id}/publish`)
      .expect(401);
  });

  it('returns not found when publishing a missing event', async () => {
    const merchant = await signUpAs('merchant');

    const response = await request(app.getHttpServer())
      .post('/events/missing-event/publish')
      .set('Cookie', merchant.cookie);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('EVENT_NOT_FOUND');
  });

  it('rejects a draft without an active ticket type', async () => {
    const merchant = await signUpAs('merchant');
    const event = await createEventFor(merchant.userId);
    await createTicketTypeFor(event.id, { status: 'INACTIVE' });

    const response = await request(app.getHttpServer())
      .post(`/events/${event.id}/publish`)
      .set('Cookie', merchant.cookie);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'EVENT_HAS_NO_ACTIVE_TICKET_TYPES',
      message: 'Add at least one active ticket type before publishing',
    });
  });

  it('rejects an invalid persisted event time range', async () => {
    const merchant = await signUpAs('merchant');
    const event = await createEventFor(merchant.userId, {
      startsAt: new Date('2026-10-20T09:00:00.000Z'),
      endsAt: new Date('2026-10-20T01:00:00.000Z'),
    });
    await createTicketTypeFor(event.id);

    const response = await request(app.getHttpServer())
      .post(`/events/${event.id}/publish`)
      .set('Cookie', merchant.cookie);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('EVENT_TIME_RANGE_INVALID');
  });

  it('returns an already published event without repeating the transition', async () => {
    const merchant = await signUpAs('merchant');
    const event = await createEventFor(merchant.userId, {
      status: 'PUBLISHED',
    });

    const response = await request(app.getHttpServer())
      .post(`/events/${event.id}/publish`)
      .set('Cookie', merchant.cookie);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: event.id,
      status: 'PUBLISHED',
    });
    expect(response.body.updatedAt).toBe(event.updatedAt.toISOString());
  });

  it('lists only published events for anonymous visitors', async () => {
    const merchant = await signUpAs('merchant');
    const draft = await createEventFor(merchant.userId, {
      name: 'Hidden draft event',
    });
    const published = await createEventFor(merchant.userId, {
      name: 'Visible published event',
      status: 'PUBLISHED',
    });

    const response = await request(app.getHttpServer()).get('/events');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: published.id,
          name: 'Visible published event',
          status: 'PUBLISHED',
        }),
      ]),
    );
    expect(
      (response.body as Array<{ id: string }>).some(
        (event) => event.id === draft.id,
      ),
    ).toBe(false);
  });

  it('returns a published event with active ticket types and server remaining', async () => {
    const merchant = await signUpAs('merchant');
    const event = await createEventFor(merchant.userId, {
      status: 'PUBLISHED',
    });
    const active = await createTicketTypeFor(event.id, {
      name: 'Available Pass',
      totalSupply: 100,
      claimedCount: 25,
    });
    const inactive = await createTicketTypeFor(event.id, {
      name: 'Hidden Pass',
      status: 'INACTIVE',
    });

    const response = await request(app.getHttpServer()).get(
      `/events/${event.id}`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: event.id,
      status: 'PUBLISHED',
      ticketTypes: [
        {
          id: active.id,
          name: 'Available Pass',
          price: '0',
          totalSupply: 100,
          claimedCount: 25,
          remaining: 75,
          status: 'ACTIVE',
        },
      ],
    });
    expect(
      (response.body.ticketTypes as Array<{ id: string }>).some(
        (ticketType) => ticketType.id === inactive.id,
      ),
    ).toBe(false);
    expect(response.body).not.toHaveProperty('organizerId');
  });

  it('does not expose a draft through the public detail endpoint', async () => {
    const merchant = await signUpAs('merchant');
    const event = await createEventFor(merchant.userId);

    const response = await request(app.getHttpServer()).get(
      `/events/${event.id}`,
    );

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('EVENT_NOT_FOUND');
  });

  async function signUpAs(role: 'admin' | 'merchant' | 'user') {
    const email = `${testEmailPrefix}-${role}-${crypto.randomUUID()}@chainpass.local`;
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', 'http://localhost:3000')
      .send({
        name: `${role} publishing test user`,
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

  function createEventFor(
    organizerId: string,
    overrides: Partial<{
      name: string;
      startsAt: Date;
      endsAt: Date;
      status: 'DRAFT' | 'PUBLISHED';
    }> = {},
  ) {
    return prisma.event.create({
      data: {
        name: overrides.name ?? 'Publishable ChainPass event',
        description: 'Public discovery test event',
        location: 'Shanghai',
        startsAt: overrides.startsAt ?? new Date('2026-10-20T01:00:00.000Z'),
        endsAt: overrides.endsAt ?? new Date('2026-10-20T09:00:00.000Z'),
        status: overrides.status,
        organizerId,
      },
    });
  }

  function createTicketTypeFor(
    eventId: string,
    overrides: Partial<{
      name: string;
      totalSupply: number;
      claimedCount: number;
      status: 'ACTIVE' | 'INACTIVE';
    }> = {},
  ) {
    return prisma.ticketType.create({
      data: {
        eventId,
        name: overrides.name ?? 'General Pass',
        totalSupply: overrides.totalSupply ?? 100,
        claimedCount: overrides.claimedCount,
        status: overrides.status,
        price: 0,
      },
    });
  }
});
