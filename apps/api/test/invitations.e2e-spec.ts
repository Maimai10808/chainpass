import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { prisma } from '../src/database/prisma.js';

describe('Shareable event invitations', () => {
  let app: INestApplication<App>;
  const prefix = `invitation-e2e-${crypto.randomUUID()}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ bodyParser: false });
    await app.init();
  });

  afterAll(async () => {
    const scope = { organizer: { email: { startsWith: prefix } } };
    await prisma.checkIn.deleteMany({ where: { event: scope } });
    await prisma.pass.deleteMany({ where: { event: scope } });
    await prisma.event.deleteMany({ where: scope });
    await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } });
    await app.close();
  });

  it('publishes an OpenAPI contract with explicit management auth and anonymous preview', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .addCookieAuth('better-auth.session_token', undefined, 'session')
        .build(),
    );
    const management = document.paths['/events/{eventId}/invitations']!;
    expect(management.post?.operationId).toBe('createInvitation');
    expect(management.post?.security).toEqual([{ session: [] }]);
    expect(management.get?.operationId).toBe('listInvitations');
    const resolve = document.paths['/invitations/resolve']!.post!;
    expect(resolve.operationId).toBe('resolveInvitation');
    expect(resolve.security).toEqual([]);
    expect(
      document.paths['/invitations/{invitationId}/revoke']!.post?.operationId,
    ).toBe('revokeInvitation');
    const claim = document.paths['/ticket-types/{ticketTypeId}/claim']!.post!;
    expect(claim.operationId).toBe('claimPass');
    expect(claim.responses).toHaveProperty('403');
    expect(claim.requestBody).toMatchObject({ required: false });
    const schemas = document.components!.schemas!;
    expect(schemas.EventResponseDto).toMatchObject({
      properties: { accessMode: { enum: ['PUBLIC', 'INVITE_ONLY'] } },
      required: expect.arrayContaining(['accessMode']),
    });
    expect(schemas.ClaimPassDto).toMatchObject({
      properties: { invitationToken: { minLength: 43, maxLength: 43 } },
    });
  });

  it('creates new events as invite-only while preserving public discovery', async () => {
    const merchant = await account('merchant');
    const privateEvent = await event(merchant);
    expect(privateEvent.accessMode).toBe('INVITE_ONLY');
    const publicEvent = await event(merchant, 'PUBLIC');
    for (const item of [privateEvent, publicEvent]) {
      await ticket(merchant, item.id);
      await request(app.getHttpServer())
        .post(`/events/${item.id}/publish`)
        .set('Cookie', merchant.cookie)
        .expect(200);
    }
    const list = await request(app.getHttpServer()).get('/events').expect(200);
    expect(
      list.body.some((item: { id: string }) => item.id === privateEvent.id),
    ).toBe(false);
    expect(
      list.body.some((item: { id: string }) => item.id === publicEvent.id),
    ).toBe(true);
    await request(app.getHttpServer())
      .get(`/events/${privateEvent.id}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/events/${publicEvent.id}`)
      .expect(200);
  });

  it('lets a forwarded invitation issue separate passes without exposing its credential in lists', async () => {
    const merchant = await account('merchant');
    const first = await account('user');
    const second = await account('user');
    const item = await event(merchant);
    const type = await ticket(merchant, item.id);
    await request(app.getHttpServer())
      .post(`/events/${item.id}/publish`)
      .set('Cookie', merchant.cookie)
      .expect(200);
    const created = await request(app.getHttpServer())
      .post(`/events/${item.id}/invitations`)
      .set('Cookie', merchant.cookie)
      .send({
        ticketTypeId: type.id,
        maxUses: 2,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      })
      .expect(201);
    expect(created.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const preview = await request(app.getHttpServer())
      .post('/invitations/resolve')
      .send({ token: created.body.token })
      .expect(200);
    expect(preview.headers['cache-control']).toContain('no-store');
    expect(preview.body.ticketType.id).toBe(type.id);
    expect(preview.body.event).not.toHaveProperty('organizerId');
    const list = await request(app.getHttpServer())
      .get(`/events/${item.id}/invitations`)
      .set('Cookie', merchant.cookie)
      .expect(200);
    expect(list.body[0]).not.toHaveProperty('token');
    expect(list.body[0]).not.toHaveProperty('tokenHash');
    const passes = [];
    for (const attendee of [first, second]) {
      const claim = await request(app.getHttpServer())
        .post(`/ticket-types/${type.id}/claim`)
        .set('Cookie', attendee.cookie)
        .send({ invitationToken: created.body.token })
        .expect(201);
      passes.push(claim.body.pass.id);
    }
    expect(passes[0]).not.toBe(passes[1]);
    const consumed = await request(app.getHttpServer())
      .get(`/events/${item.id}/invitations`)
      .set('Cookie', merchant.cookie)
      .expect(200);
    expect(consumed.body[0].usedCount).toBe(2);
  });

  it('prevents ordinary users and other merchants from reading management ticket inventory', async () => {
    const merchant = await account('merchant');
    const other = await account('merchant');
    const attendee = await account('user');
    const admin = await account('admin');
    const item = await event(merchant);
    await ticket(merchant, item.id);
    for (const actor of [other, attendee]) {
      await request(app.getHttpServer())
        .get(`/events/${item.id}/ticket-types`)
        .set('Cookie', actor.cookie)
        .expect(403);
    }
    await request(app.getHttpServer())
      .get(`/events/${item.id}/ticket-types`)
      .expect(401);
    for (const actor of [merchant, admin]) {
      await request(app.getHttpServer())
        .get(`/events/${item.id}/ticket-types`)
        .set('Cookie', actor.cookie)
        .expect(200);
    }
  });

  it('requires a credential even when the private ticket type ID is known', async () => {
    const setup = await publishedInvitation();
    const attendee = await account('user');
    const denied = await claim(setup.type.id, attendee);
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('INVITATION_REQUIRED');
    await unchanged(setup);
  });

  it('does not consume invitations on preview, anonymous, forbidden or malformed claims', async () => {
    const setup = await publishedInvitation();
    for (let i = 0; i < 2; i++)
      await request(app.getHttpServer())
        .post('/invitations/resolve')
        .send({ token: setup.token })
        .expect(200);
    await request(app.getHttpServer())
      .post(`/ticket-types/${setup.type.id}/claim`)
      .send({ invitationToken: setup.token })
      .expect(401);
    await claim(setup.type.id, setup.merchant, setup.token).expect(403);
    const attendee = await account('user');
    for (const body of [
      { invitationToken: setup.token, ownerId: 'spoof' },
      { invitationToken: 'bad' },
      { maxUses: 99 },
    ]) {
      await request(app.getHttpServer())
        .post(`/ticket-types/${setup.type.id}/claim`)
        .set('Cookie', attendee.cookie)
        .send(body)
        .expect(400);
    }
    await unchanged(setup);
  });

  it('rejects unknown credentials and credentials for a different event or ticket type', async () => {
    const setup = await publishedInvitation();
    const another = await publishedInvitation();
    const attendee = await account('user');
    const otherType = await ticket(setup.merchant, setup.item.id);
    for (const [typeId, token] of [
      [setup.type.id, 'A'.repeat(43)],
      [another.type.id, setup.token],
      [otherType.id, setup.token],
    ]) {
      const denied = await claim(typeId!, attendee, token!);
      expect(denied.status).toBe(400);
      expect(denied.body.code).toBe('INVALID_INVITATION');
    }
    await unchanged(setup);
    await unchanged(another);
  });

  it('rejects expired invitations on preview and claim without consuming inventory', async () => {
    const setup = await publishedInvitation();
    // Expiration fixture, observed through the HTTP boundary. No production data is involved.
    await prisma.invitation.update({
      where: { id: setup.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const attendee = await account('user');
    const preview = await request(app.getHttpServer())
      .post('/invitations/resolve')
      .send({ token: setup.token });
    expect(preview.status).toBe(409);
    expect(preview.body.code).toBe('INVITATION_EXPIRED');
    const denied = await claim(setup.type.id, attendee, setup.token);
    expect(denied.status).toBe(409);
    expect(denied.body.code).toBe('INVITATION_EXPIRED');
    await unchanged(setup);
  });

  it('revokes future claims idempotently without invalidating an issued pass or QR check-in', async () => {
    const setup = await publishedInvitation();
    const first = await account('user');
    const second = await account('user');
    const issued = await claim(setup.type.id, first, setup.token).expect(201);
    const revoke = await request(app.getHttpServer())
      .post(`/invitations/${setup.id}/revoke`)
      .set('Cookie', setup.merchant.cookie)
      .expect(200);
    const again = await request(app.getHttpServer())
      .post(`/invitations/${setup.id}/revoke`)
      .set('Cookie', setup.merchant.cookie)
      .expect(200);
    expect(again.body.revokedAt).toBe(revoke.body.revokedAt);
    const denied = await claim(setup.type.id, second, setup.token);
    expect(denied.body.code).toBe('INVITATION_REVOKED');
    const qr = await request(app.getHttpServer())
      .post(`/passes/${issued.body.pass.id}/verification-token`)
      .set('Cookie', first.cookie)
      .expect(201);
    const verify = await request(app.getHttpServer())
      .post('/passes/verify-token')
      .set('Cookie', setup.merchant.cookie)
      .send({ token: qr.body.token })
      .expect(200);
    expect(verify.body.verificationStatus).toBe('VALID');
    await request(app.getHttpServer())
      .post(`/passes/${issued.body.pass.id}/check-in`)
      .set('Cookie', setup.merchant.cookie)
      .send({ method: 'QR' })
      .expect(201);
    const replay = await request(app.getHttpServer())
      .post('/passes/verify-token')
      .set('Cookie', setup.merchant.cookie)
      .send({ token: qr.body.token })
      .expect(200);
    expect(replay.body.verificationStatus).toBe('ALREADY_CHECKED_IN');
    await request(app.getHttpServer())
      .post(`/passes/${issued.body.pass.id}/check-in`)
      .set('Cookie', setup.merchant.cookie)
      .send({ method: 'MANUAL' })
      .expect(409);
    const passes = await request(app.getHttpServer())
      .get('/passes/me')
      .set('Cookie', first.cookie)
      .expect(200);
    expect(passes.body[0].status).toBe('CHECKED_IN');
  });

  it('prevents cross-merchant management and unauthorized invitation operations', async () => {
    const setup = await publishedInvitation();
    const other = await account('merchant');
    const user = await account('user');
    const input = {
      ticketTypeId: setup.type.id,
      maxUses: 2,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
    for (const actor of [other, user]) {
      await request(app.getHttpServer())
        .post(`/events/${setup.item.id}/invitations`)
        .set('Cookie', actor.cookie)
        .send(input)
        .expect(403);
      await request(app.getHttpServer())
        .get(`/events/${setup.item.id}/invitations`)
        .set('Cookie', actor.cookie)
        .expect(403);
      await request(app.getHttpServer())
        .post(`/invitations/${setup.id}/revoke`)
        .set('Cookie', actor.cookie)
        .expect(403);
    }
    await request(app.getHttpServer())
      .get(`/events/${setup.item.id}/invitations`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/events/${setup.item.id}/invitations`)
      .send(input)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/invitations/${setup.id}/revoke`)
      .expect(401);
    const admin = await account('admin');
    await request(app.getHttpServer())
      .get(`/events/${setup.item.id}/invitations`)
      .set('Cookie', admin.cookie)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/invitations/${setup.id}/revoke`)
      .set('Cookie', admin.cookie)
      .expect(200);
  });

  it('rejects invalid creation fields, cross-event types, inactive types, draft and public events', async () => {
    const setup = await publishedInvitation();
    const other = await publishedInvitation();
    const input = {
      ticketTypeId: setup.type.id,
      maxUses: 2,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
    for (const data of [
      { ...input, maxUses: 0 },
      { ...input, expiresAt: new Date(0).toISOString() },
      { ...input, ownerId: 'spoof' },
      { ...input, ticketTypeId: other.type.id },
    ]) {
      await request(app.getHttpServer())
        .post(`/events/${setup.item.id}/invitations`)
        .set('Cookie', setup.merchant.cookie)
        .send(data)
        .expect(400);
    }
    const draft = await event(setup.merchant);
    const draftType = await ticket(setup.merchant, draft.id);
    await request(app.getHttpServer())
      .post(`/events/${draft.id}/invitations`)
      .set('Cookie', setup.merchant.cookie)
      .send({ ...input, ticketTypeId: draftType.id })
      .expect(409);
    const publicItem = await event(setup.merchant, 'PUBLIC');
    const publicType = await ticket(setup.merchant, publicItem.id);
    await request(app.getHttpServer())
      .post(`/events/${publicItem.id}/publish`)
      .set('Cookie', setup.merchant.cookie)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/events/${publicItem.id}/invitations`)
      .set('Cookie', setup.merchant.cookie)
      .send({ ...input, ticketTypeId: publicType.id })
      .expect(409);
    await prisma.ticketType.update({
      where: { id: setup.type.id },
      data: { status: 'INACTIVE' },
    });
    await request(app.getHttpServer())
      .post(`/events/${setup.item.id}/invitations`)
      .set('Cookie', setup.merchant.cookie)
      .send(input)
      .expect(400);
    const preview = await request(app.getHttpServer())
      .post('/invitations/resolve')
      .send({ token: setup.token });
    expect(preview.body.code).toBe('INVITATION_UNAVAILABLE');
  });

  it('allows only one successful claim for a one-use invitation under concurrency', async () => {
    const setup = await publishedInvitation(1, 5);
    const users = await Promise.all([account('user'), account('user')]);
    const result = await Promise.all(
      users.map((user) => claim(setup.type.id, user, setup.token)),
    );
    expect(
      result.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([201, 409]);
    expect(result.find((response) => response.status === 409)?.body.code).toBe(
      'INVITATION_EXHAUSTED',
    );
    await counters(setup, 1, 1);
    const preview = await request(app.getHttpServer())
      .post('/invitations/resolve')
      .send({ token: setup.token });
    expect(preview.body.code).toBe('INVITATION_EXHAUSTED');
  });

  it('rolls back invitation consumption when multiple links compete for the last ticket', async () => {
    const setup = await publishedInvitation(5, 1);
    const second = await invitation(
      setup.merchant,
      setup.item.id,
      setup.type.id,
      5,
    );
    const users = await Promise.all([account('user'), account('user')]);
    const result = await Promise.all([
      claim(setup.type.id, users[0]!, setup.token),
      claim(setup.type.id, users[1]!, second.token),
    ]);
    expect(
      result.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([201, 409]);
    expect(result.find((response) => response.status === 409)?.body.code).toBe(
      'TICKET_TYPE_SOLD_OUT',
    );
    const list = await request(app.getHttpServer())
      .get(`/events/${setup.item.id}/invitations`)
      .set('Cookie', setup.merchant.cookie)
      .expect(200);
    expect(
      list.body
        .map((row: { usedCount: number }) => row.usedCount)
        .sort((a: number, b: number) => a - b),
    ).toEqual([0, 1]);
    const tickets = await request(app.getHttpServer())
      .get(`/events/${setup.item.id}/ticket-types`)
      .set('Cookie', setup.merchant.cookie)
      .expect(200);
    expect(tickets.body[0].claimedCount).toBe(1);
  });

  it('does not spend extra quota or inventory for concurrent duplicate claims', async () => {
    const setup = await publishedInvitation();
    const user = await account('user');
    const result = await Promise.all([
      claim(setup.type.id, user, setup.token),
      claim(setup.type.id, user, setup.token),
    ]);
    expect(
      result.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([201, 409]);
    expect(result.find((response) => response.status === 409)?.body.code).toBe(
      'PASS_ALREADY_CLAIMED',
    );
    await counters(setup, 1, 1);
  });

  async function invitation(
    merchant: { cookie: string },
    eventId: string,
    ticketTypeId: string,
    maxUses = 5,
  ) {
    const result = await request(app.getHttpServer())
      .post(`/events/${eventId}/invitations`)
      .set('Cookie', merchant.cookie)
      .send({
        ticketTypeId,
        maxUses,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      })
      .expect(201);
    return {
      id: result.body.invitation.id as string,
      token: result.body.token as string,
    };
  }
  async function publishedInvitation(maxUses = 5, totalSupply = 10) {
    const merchant = await account('merchant');
    const item = await event(merchant);
    const type = await ticket(merchant, item.id, totalSupply);
    await request(app.getHttpServer())
      .post(`/events/${item.id}/publish`)
      .set('Cookie', merchant.cookie)
      .expect(200);
    return {
      merchant,
      item,
      type,
      ...(await invitation(merchant, item.id, type.id, maxUses)),
    };
  }
  function claim(typeId: string, attendee: { cookie: string }, token?: string) {
    return request(app.getHttpServer())
      .post(`/ticket-types/${typeId}/claim`)
      .set('Cookie', attendee.cookie)
      .send(token ? { invitationToken: token } : {});
  }
  async function counters(
    setup: Awaited<ReturnType<typeof publishedInvitation>>,
    used: number,
    stock: number,
  ) {
    const links = await request(app.getHttpServer())
      .get(`/events/${setup.item.id}/invitations`)
      .set('Cookie', setup.merchant.cookie)
      .expect(200);
    expect(links.body[0].usedCount).toBe(used);
    const types = await request(app.getHttpServer())
      .get(`/events/${setup.item.id}/ticket-types`)
      .set('Cookie', setup.merchant.cookie)
      .expect(200);
    expect(types.body[0].claimedCount).toBe(stock);
  }
  async function unchanged(
    setup: Awaited<ReturnType<typeof publishedInvitation>>,
  ) {
    await counters(setup, 0, 0);
  }

  async function account(role: 'user' | 'merchant' | 'admin') {
    const signup = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', 'http://localhost:3000')
      .send({
        name: `Invitation ${role}`,
        email: `${prefix}-${crypto.randomUUID()}@chainpass.local`,
        password: 'LocalInvitationTest123!',
      })
      .expect(200);
    const userId = signup.body.user.id as string;
    // Local isolated-test role bootstrap; production role changes remain Better Auth Admin operations.
    await prisma.user.update({ where: { id: userId }, data: { role } });
    const cookies = signup.headers['set-cookie'];
    const cookie = (Array.isArray(cookies) ? cookies : [cookies])
      .map((value: string) => value.split(';')[0])
      .join('; ');
    return { userId, cookie };
  }

  async function event(merchant: { cookie: string }, accessMode?: string) {
    const result = await request(app.getHttpServer())
      .post('/events')
      .set('Cookie', merchant.cookie)
      .send({
        name: 'Invitation E2E event',
        startsAt: '2027-01-01T01:00:00.000Z',
        endsAt: '2027-01-01T09:00:00.000Z',
        ...(accessMode ? { accessMode } : {}),
      })
      .expect(201);
    return result.body as { id: string; accessMode: string };
  }

  async function ticket(
    merchant: { cookie: string },
    eventId: string,
    totalSupply = 10,
  ) {
    const result = await request(app.getHttpServer())
      .post(`/events/${eventId}/ticket-types`)
      .set('Cookie', merchant.cookie)
      .send({ name: 'General Pass', price: 0, totalSupply })
      .expect(201);
    return result.body as { id: string };
  }
});
