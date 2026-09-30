import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

import { AppModule } from '../src/app.module.js';
import { prisma } from '../src/database/prisma.js';

describe('Pass claiming and My Passes', () => {
  let app: INestApplication<App>;

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const testEmailPrefix = `pass-claiming-e2e-${runId}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await prisma.pass.deleteMany({
      where: {
        owner: {
          email: {
            startsWith: testEmailPrefix,
          },
        },
      },
    });
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

  it('claims an available pass and returns it from My Passes', async () => {
    const organizer = await signUpAs('merchant');
    const attendee = await signUpAs('user');
    const event = await createEventFor(organizer.userId, 'PUBLISHED');
    const ticketType = await createTicketTypeFor(event.id, {
      totalSupply: 2,
    });

    const claim = await request(app.getHttpServer())
      .post(`/ticket-types/${ticketType.id}/claim`)
      .set('Cookie', attendee.cookie);

    expect(claim.status).toBe(201);
    expect(claim.body).toMatchObject({
      remaining: 1,
      pass: {
        status: 'ACTIVE',
        tokenId: null,
        mintTxHash: null,
        contractAddress: null,
        event: {
          id: event.id,
          name: 'Pass claiming test event',
        },
        ticketType: {
          id: ticketType.id,
          name: 'General Pass',
          price: '0',
        },
      },
    });

    const myPasses = await request(app.getHttpServer())
      .get('/passes/me')
      .set('Cookie', attendee.cookie);

    expect(myPasses.status).toBe(200);
    expect(myPasses.body).toMatchObject([
      {
        id: claim.body.pass.id,
        status: 'ACTIVE',
        event: { id: event.id },
        ticketType: { id: ticketType.id },
      },
    ]);
  });

  it('rejects an anonymous claim', async () => {
    const organizer = await signUpAs('merchant');
    const event = await createEventFor(organizer.userId, 'PUBLISHED');
    const ticketType = await createTicketTypeFor(event.id);

    await request(app.getHttpServer())
      .post(`/ticket-types/${ticketType.id}/claim`)
      .expect(401);
  });

  it('rejects a client-supplied owner identity', async () => {
    const organizer = await signUpAs('merchant');
    const attendee = await signUpAs('user');
    const event = await createEventFor(organizer.userId, 'PUBLISHED');
    const ticketType = await createTicketTypeFor(event.id);

    const response = await request(app.getHttpServer())
      .post(`/ticket-types/${ticketType.id}/claim`)
      .set('Cookie', attendee.cookie)
      .send({ ownerId: 'client-controlled-user-id' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    await expectClaimedCount(ticketType.id, 0);
  });

  it('forbids a merchant without the pass claim permission', async () => {
    const organizer = await signUpAs('merchant');
    const event = await createEventFor(organizer.userId, 'PUBLISHED');
    const ticketType = await createTicketTypeFor(event.id);

    await request(app.getHttpServer())
      .post(`/ticket-types/${ticketType.id}/claim`)
      .set('Cookie', organizer.cookie)
      .expect(403);
  });

  it('returns not found for a missing ticket type', async () => {
    const attendee = await signUpAs('user');

    const response = await request(app.getHttpServer())
      .post('/ticket-types/missing-ticket-type/claim')
      .set('Cookie', attendee.cookie);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('TICKET_TYPE_NOT_FOUND');
  });

  it('rejects a claim from a draft event without changing inventory', async () => {
    const organizer = await signUpAs('merchant');
    const attendee = await signUpAs('user');
    const event = await createEventFor(organizer.userId, 'DRAFT');
    const ticketType = await createTicketTypeFor(event.id);

    const response = await request(app.getHttpServer())
      .post(`/ticket-types/${ticketType.id}/claim`)
      .set('Cookie', attendee.cookie);

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('EVENT_NOT_PUBLISHED');
    await expectClaimedCount(ticketType.id, 0);
  });

  it('rejects an inactive ticket type without changing inventory', async () => {
    const organizer = await signUpAs('merchant');
    const attendee = await signUpAs('user');
    const event = await createEventFor(organizer.userId, 'PUBLISHED');
    const ticketType = await createTicketTypeFor(event.id, {
      status: 'INACTIVE',
    });

    const response = await request(app.getHttpServer())
      .post(`/ticket-types/${ticketType.id}/claim`)
      .set('Cookie', attendee.cookie);

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('TICKET_TYPE_INACTIVE');
    await expectClaimedCount(ticketType.id, 0);
  });

  it('rejects a sold-out ticket type without changing inventory', async () => {
    const organizer = await signUpAs('merchant');
    const attendee = await signUpAs('user');
    const event = await createEventFor(organizer.userId, 'PUBLISHED');
    const ticketType = await createTicketTypeFor(event.id, {
      totalSupply: 1,
      claimedCount: 1,
    });

    const response = await request(app.getHttpServer())
      .post(`/ticket-types/${ticketType.id}/claim`)
      .set('Cookie', attendee.cookie);

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('TICKET_TYPE_SOLD_OUT');
    await expectClaimedCount(ticketType.id, 1);
  });

  it('rejects a duplicate claim and rolls back its inventory increment', async () => {
    const organizer = await signUpAs('merchant');
    const attendee = await signUpAs('user');
    const event = await createEventFor(organizer.userId, 'PUBLISHED');
    const ticketType = await createTicketTypeFor(event.id, { totalSupply: 2 });

    await request(app.getHttpServer())
      .post(`/ticket-types/${ticketType.id}/claim`)
      .set('Cookie', attendee.cookie)
      .expect(201);

    const duplicate = await request(app.getHttpServer())
      .post(`/ticket-types/${ticketType.id}/claim`)
      .set('Cookie', attendee.cookie);

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('PASS_ALREADY_CLAIMED');
    await expectClaimedCount(ticketType.id, 1);
  });

  it('returns only passes owned by the current session user', async () => {
    const organizer = await signUpAs('merchant');
    const attendeeA = await signUpAs('user');
    const attendeeB = await signUpAs('user');
    const event = await createEventFor(organizer.userId, 'PUBLISHED');
    const ticketType = await createTicketTypeFor(event.id, { totalSupply: 2 });

    const claimA = await request(app.getHttpServer())
      .post(`/ticket-types/${ticketType.id}/claim`)
      .set('Cookie', attendeeA.cookie)
      .expect(201);
    const claimB = await request(app.getHttpServer())
      .post(`/ticket-types/${ticketType.id}/claim`)
      .set('Cookie', attendeeB.cookie)
      .expect(201);

    const myPasses = await request(app.getHttpServer())
      .get('/passes/me')
      .set('Cookie', attendeeA.cookie)
      .expect(200);

    expect(myPasses.body).toHaveLength(1);
    expect(myPasses.body[0].id).toBe(claimA.body.pass.id);
    expect(myPasses.body[0].id).not.toBe(claimB.body.pass.id);
  });

  it('allows only one of two concurrent users to claim the last pass', async () => {
    const organizer = await signUpAs('merchant');
    const attendeeA = await signUpAs('user');
    const attendeeB = await signUpAs('user');
    const event = await createEventFor(organizer.userId, 'PUBLISHED');
    const ticketType = await createTicketTypeFor(event.id, { totalSupply: 1 });

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post(`/ticket-types/${ticketType.id}/claim`)
        .set('Cookie', attendeeA.cookie),
      request(app.getHttpServer())
        .post(`/ticket-types/${ticketType.id}/claim`)
        .set('Cookie', attendeeB.cookie),
    ]);

    expect(
      responses
        .map((response) => response.status)
        .sort((left, right) => left - right),
    ).toEqual([201, 409]);
    expect(
      responses.find((response) => response.status === 409)?.body.code,
    ).toBe('TICKET_TYPE_SOLD_OUT');
    await expectClaimedCount(ticketType.id, 1);

    const passCounts = await Promise.all(
      [attendeeA, attendeeB].map(async (attendee) => {
        const response = await request(app.getHttpServer())
          .get('/passes/me')
          .set('Cookie', attendee.cookie)
          .expect(200);
        return (response.body as unknown[]).length;
      }),
    );
    expect(passCounts.sort((left, right) => left - right)).toEqual([0, 1]);
  });

  it('requires authentication to list My Passes', async () => {
    await request(app.getHttpServer()).get('/passes/me').expect(401);
  });

  async function signUpAs(role: 'admin' | 'merchant' | 'user') {
    const email = `${testEmailPrefix}-${role}-${crypto.randomUUID()}@chainpass.local`;
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', 'http://localhost:3000')
      .send({
        name: `${role} pass test user`,
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

  function createEventFor(organizerId: string, status: 'DRAFT' | 'PUBLISHED') {
    return prisma.event.create({
      data: {
        name: 'Pass claiming test event',
        location: 'Shanghai',
        startsAt: new Date('2026-11-01T01:00:00.000Z'),
        endsAt: new Date('2026-11-01T09:00:00.000Z'),
        status,
        organizerId,
      },
    });
  }

  function createTicketTypeFor(
    eventId: string,
    overrides: Partial<{
      claimedCount: number;
      name: string;
      status: 'ACTIVE' | 'INACTIVE';
      totalSupply: number;
    }> = {},
  ) {
    return prisma.ticketType.create({
      data: {
        eventId,
        name: overrides.name ?? 'General Pass',
        price: 0,
        totalSupply: overrides.totalSupply ?? 100,
        claimedCount: overrides.claimedCount,
        status: overrides.status,
      },
    });
  }

  async function expectClaimedCount(ticketTypeId: string, expected: number) {
    const ticketType = await prisma.ticketType.findUniqueOrThrow({
      where: { id: ticketTypeId },
      select: { claimedCount: true },
    });

    expect(ticketType.claimedCount).toBe(expected);
  }
});
