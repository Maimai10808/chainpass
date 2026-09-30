import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module.js';
import { prisma } from '../src/database/prisma.js';

describe('Merchant ticket type issuance', () => {
  let app: INestApplication<App>;

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const testEmailPrefix = `ticket-types-e2e-${runId}`;

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

  it('lets a merchant create a ticket type for their own event', async () => {
    const merchant = await signUpAs('merchant');
    const event = await createEventFor(merchant.userId);

    const response = await request(app.getHttpServer())
      .post(`/events/${event.id}/ticket-types`)
      .set('Cookie', merchant.cookie)
      .send({
        name: 'General Pass',
        description: 'General admission',
        totalSupply: 100,
        price: 0,
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      eventId: event.id,
      name: 'General Pass',
      totalSupply: 100,
      claimedCount: 0,
      price: '0',
      status: 'ACTIVE',
    });
  });

  it('forbids a merchant from issuing tickets for another merchant event', async () => {
    const owner = await signUpAs('merchant');
    const otherMerchant = await signUpAs('merchant');
    const event = await createEventFor(owner.userId);

    const response = await request(app.getHttpServer())
      .post(`/events/${event.id}/ticket-types`)
      .set('Cookie', otherMerchant.cookie)
      .send(validTicketType());

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      code: 'EVENT_OWNERSHIP_REQUIRED',
      message: 'Only the event organizer can create ticket types',
    });
  });

  it('allows an admin to issue tickets for any event', async () => {
    const owner = await signUpAs('merchant');
    const admin = await signUpAs('admin');
    const event = await createEventFor(owner.userId);

    const response = await request(app.getHttpServer())
      .post(`/events/${event.id}/ticket-types`)
      .set('Cookie', admin.cookie)
      .send(validTicketType('Admin Pass'));

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      eventId: event.id,
      name: 'Admin Pass',
      claimedCount: 0,
    });
  });

  it('forbids a normal user from issuing tickets', async () => {
    const owner = await signUpAs('merchant');
    const user = await signUpAs('user');
    const event = await createEventFor(owner.userId);

    await request(app.getHttpServer())
      .post(`/events/${event.id}/ticket-types`)
      .set('Cookie', user.cookie)
      .send(validTicketType())
      .expect(403);
  });

  it('rejects anonymous ticket issuance', async () => {
    const owner = await signUpAs('merchant');
    const event = await createEventFor(owner.userId);

    await request(app.getHttpServer())
      .post(`/events/${event.id}/ticket-types`)
      .send(validTicketType())
      .expect(401);
  });

  it('returns not found when the event does not exist', async () => {
    const merchant = await signUpAs('merchant');

    const response = await request(app.getHttpServer())
      .post('/events/missing-event/ticket-types')
      .set('Cookie', merchant.cookie)
      .send(validTicketType());

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('EVENT_NOT_FOUND');
  });

  it('rejects a zero ticket supply', async () => {
    const merchant = await signUpAs('merchant');
    const event = await createEventFor(merchant.userId);

    const response = await request(app.getHttpServer())
      .post(`/events/${event.id}/ticket-types`)
      .set('Cookie', merchant.cookie)
      .send({ ...validTicketType(), totalSupply: 0 });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
    });
  });

  it('rejects a client-supplied claimed count', async () => {
    const merchant = await signUpAs('merchant');
    const event = await createEventFor(merchant.userId);

    const response = await request(app.getHttpServer())
      .post(`/events/${event.id}/ticket-types`)
      .set('Cookie', merchant.cookie)
      .send({ ...validTicketType(), claimedCount: 99 });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('lists all ticket types for an event', async () => {
    const merchant = await signUpAs('merchant');
    const event = await createEventFor(merchant.userId);

    for (const ticketType of [
      validTicketType('General Pass', 100),
      validTicketType('VIP Pass', 20),
    ]) {
      await request(app.getHttpServer())
        .post(`/events/${event.id}/ticket-types`)
        .set('Cookie', merchant.cookie)
        .send(ticketType)
        .expect(201);
    }

    const response = await request(app.getHttpServer())
      .get(`/events/${event.id}/ticket-types`)
      .set('Cookie', merchant.cookie);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject([
      {
        name: 'General Pass',
        totalSupply: 100,
        claimedCount: 0,
        price: '0',
      },
      {
        name: 'VIP Pass',
        totalSupply: 20,
        claimedCount: 0,
        price: '0',
      },
    ]);
  });

  async function signUpAs(role: 'admin' | 'merchant' | 'user') {
    const email = `${testEmailPrefix}-${role}-${crypto.randomUUID()}@chainpass.local`;
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', 'http://localhost:3000')
      .send({
        name: `${role} ticket test user`,
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

  function createEventFor(organizerId: string) {
    return prisma.event.create({
      data: {
        name: 'Ticket type test event',
        startsAt: new Date('2026-10-10T01:00:00.000Z'),
        endsAt: new Date('2026-10-10T09:00:00.000Z'),
        organizerId,
      },
    });
  }

  function validTicketType(name = 'General Pass', totalSupply = 100) {
    return {
      name,
      description: 'Admission ticket',
      totalSupply,
      price: 0,
    };
  }
});
