import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { CHAINPASS_SEPOLIA_CHAIN_ID } from '@chainpass/web3';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { vi } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { BlockchainService } from '../src/blockchain/blockchain.service.js';
import { QR_TOKEN_CLOCK } from '../src/check-ins/qr-verification-token.service.js';
import { prisma } from '../src/database/prisma.js';

describe('Merchant pass verification and check-in', () => {
  let app: INestApplication<App>;
  const originalQrSecret = process.env.QR_VERIFICATION_SECRET;

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const testEmailPrefix = `check-in-e2e-${runId}`;
  const verifyTokenOwner = vi.fn();
  let qrNow = Date.now();

  beforeAll(async () => {
    process.env.QR_VERIFICATION_SECRET =
      'test-only-qr-verification-secret-at-least-32-characters';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(BlockchainService)
      .useValue({ verifyTokenOwner })
      .overrideProvider(QR_TOKEN_CLOCK)
      .useValue(() => qrNow)
      .compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    await app.init();
  });

  beforeEach(() => {
    qrNow = Date.now();
    verifyTokenOwner.mockReset();
  });

  afterAll(async () => {
    await prisma.checkIn.deleteMany({
      where: { pass: { owner: { email: { startsWith: testEmailPrefix } } } },
    });
    await prisma.pass.deleteMany({
      where: { owner: { email: { startsWith: testEmailPrefix } } },
    });
    await prisma.event.deleteMany({
      where: { organizer: { email: { startsWith: testEmailPrefix } } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: testEmailPrefix } },
    });
    await app.close();

    if (originalQrSecret === undefined) {
      delete process.env.QR_VERIFICATION_SECRET;
    } else {
      process.env.QR_VERIFICATION_SECRET = originalQrSecret;
    }
  });

  it('lets a pass owner create a short-lived token that the organizer can verify', async () => {
    const merchant = await signUpAs('merchant');
    const holder = await signUpAs('user');
    const pass = await createPass(merchant.userId, holder.userId);

    const tokenResponse = await request(app.getHttpServer())
      .post(`/passes/${pass.id}/verification-token`)
      .set('Cookie', holder.cookie);

    expect(tokenResponse.status).toBe(201);
    expect(tokenResponse.body).toEqual({
      token: expect.any(String),
      expiresAt: expect.any(String),
    });
    expect(new Date(tokenResponse.body.expiresAt).getTime()).toBeGreaterThan(
      Date.now(),
    );
    const payload = JSON.parse(
      Buffer.from(
        tokenResponse.body.token.split('.')[0],
        'base64url',
      ).toString(),
    );
    expect(payload).toEqual({
      v: 1,
      passId: pass.id,
      ownerId: holder.userId,
      nonce: expect.any(String),
      iat: expect.any(Number),
      exp: expect.any(Number),
    });
    expect(payload.exp - payload.iat).toBe(60);
    expect(JSON.stringify(payload)).not.toContain(holder.email);

    const verification = await request(app.getHttpServer())
      .post('/passes/verify-token')
      .set('Cookie', merchant.cookie)
      .send({ token: tokenResponse.body.token });

    expect(verification.status).toBe(200);
    expect(verification.body).toMatchObject({
      verificationStatus: 'VALID',
      canCheckIn: true,
      pass: { id: pass.id, status: 'ACTIVE' },
      holder: { id: holder.userId },
    });
  });

  it('rejects anonymous, non-owner, checked-in, and revoked token generation', async () => {
    const merchant = await signUpAs('merchant');
    const holder = await signUpAs('user');
    const otherUser = await signUpAs('user');
    const activePass = await createPass(merchant.userId, holder.userId);
    const checkedInPass = await createPass(
      merchant.userId,
      otherUser.userId,
      'CHECKED_IN',
    );
    const revokedOwner = await signUpAs('user');
    const revokedPass = await createPass(
      merchant.userId,
      revokedOwner.userId,
      'REVOKED',
    );

    await request(app.getHttpServer())
      .post(`/passes/${activePass.id}/verification-token`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/passes/${activePass.id}/verification-token`)
      .set('Cookie', otherUser.cookie)
      .expect(403);

    const checkedIn = await request(app.getHttpServer())
      .post(`/passes/${checkedInPass.id}/verification-token`)
      .set('Cookie', otherUser.cookie);
    expect(checkedIn.status).toBe(409);
    expect(checkedIn.body).toMatchObject({ code: 'PASS_NOT_ACTIVE' });

    const revoked = await request(app.getHttpServer())
      .post(`/passes/${revokedPass.id}/verification-token`)
      .set('Cookie', revokedOwner.cookie);
    expect(revoked.status).toBe(409);
    expect(revoked.body).toMatchObject({ code: 'PASS_NOT_ACTIVE' });
  });

  it('rejects a tampered QR token without exposing signing details', async () => {
    const merchant = await signUpAs('merchant');
    const holder = await signUpAs('user');
    const pass = await createPass(merchant.userId, holder.userId);
    const tokenResponse = await request(app.getHttpServer())
      .post(`/passes/${pass.id}/verification-token`)
      .set('Cookie', holder.cookie)
      .expect(201);
    const [payload, signature] = tokenResponse.body.token.split('.');
    const tamperedSignature = `${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;

    const response = await request(app.getHttpServer())
      .post('/passes/verify-token')
      .set('Cookie', merchant.cookie)
      .send({ token: `${payload}.${tamperedSignature}` });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: 'INVALID_QR_TOKEN',
      message: 'QR verification token is invalid',
    });
  });

  it('returns QR_TOKEN_EXPIRED after the 60-second token lifetime', async () => {
    const merchant = await signUpAs('merchant');
    const holder = await signUpAs('user');
    const pass = await createPass(merchant.userId, holder.userId);
    const tokenResponse = await request(app.getHttpServer())
      .post(`/passes/${pass.id}/verification-token`)
      .set('Cookie', holder.cookie)
      .expect(201);

    qrNow += 60_000;
    const response = await request(app.getHttpServer())
      .post('/passes/verify-token')
      .set('Cookie', merchant.cookie)
      .send({ token: tokenResponse.body.token });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'QR_TOKEN_EXPIRED' });
  });

  it('enforces merchant role and Event ownership for QR verification', async () => {
    const merchant = await signUpAs('merchant');
    const otherMerchant = await signUpAs('merchant');
    const holder = await signUpAs('user');
    const pass = await createPass(merchant.userId, holder.userId);
    const tokenResponse = await request(app.getHttpServer())
      .post(`/passes/${pass.id}/verification-token`)
      .set('Cookie', holder.cookie)
      .expect(201);
    const body = { token: tokenResponse.body.token };

    await request(app.getHttpServer())
      .post('/passes/verify-token')
      .send(body)
      .expect(401);
    await request(app.getHttpServer())
      .post('/passes/verify-token')
      .set('Cookie', holder.cookie)
      .send(body)
      .expect(403);
    await request(app.getHttpServer())
      .post('/passes/verify-token')
      .set('Cookie', otherMerchant.cookie)
      .send(body)
      .expect(403);
  });

  it('records QR check-in and returns ALREADY_CHECKED_IN on token replay', async () => {
    const merchant = await signUpAs('merchant');
    const holder = await signUpAs('user');
    const pass = await createPass(merchant.userId, holder.userId);
    const tokenResponse = await request(app.getHttpServer())
      .post(`/passes/${pass.id}/verification-token`)
      .set('Cookie', holder.cookie)
      .expect(201);

    await request(app.getHttpServer())
      .post('/passes/verify-token')
      .set('Cookie', merchant.cookie)
      .send({ token: tokenResponse.body.token })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/passes/${pass.id}/check-in`)
      .set('Cookie', merchant.cookie)
      .send({ method: 'QR' })
      .expect(201);

    const replay = await request(app.getHttpServer())
      .post('/passes/verify-token')
      .set('Cookie', merchant.cookie)
      .send({ token: tokenResponse.body.token });
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({
      verificationStatus: 'ALREADY_CHECKED_IN',
      canCheckIn: false,
    });
    await expect(
      prisma.checkIn.findUniqueOrThrow({ where: { passId: pass.id } }),
    ).resolves.toMatchObject({
      method: 'QR',
      verifiedById: merchant.userId,
    });
  });

  it('creates a CheckIn and marks the pass CHECKED_IN atomically', async () => {
    const merchant = await signUpAs('merchant');
    const holder = await signUpAs('user');
    const pass = await createPass(merchant.userId, holder.userId);

    const response = await request(app.getHttpServer())
      .post(`/passes/${pass.id}/check-in`)
      .set('Cookie', merchant.cookie)
      .send({ method: 'MANUAL' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      verificationStatus: 'ALREADY_CHECKED_IN',
      canCheckIn: false,
      pass: { id: pass.id, status: 'CHECKED_IN' },
      checkIn: {
        method: 'MANUAL',
        verifiedBy: { id: merchant.userId, email: merchant.email },
      },
    });

    const [persistedPass, checkIn] = await Promise.all([
      prisma.pass.findUniqueOrThrow({ where: { id: pass.id } }),
      prisma.checkIn.findUniqueOrThrow({ where: { passId: pass.id } }),
    ]);
    expect(persistedPass.status).toBe('CHECKED_IN');
    expect(checkIn.verifiedById).toBe(merchant.userId);
    expect(checkIn.eventId).toBe(pass.eventId);
  });

  it('allows exactly one of two concurrent check-in requests', async () => {
    const merchant = await signUpAs('merchant');
    const holder = await signUpAs('user');
    const pass = await createPass(merchant.userId, holder.userId);

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post(`/passes/${pass.id}/check-in`)
        .set('Cookie', merchant.cookie)
        .send({ method: 'MANUAL' }),
      request(app.getHttpServer())
        .post(`/passes/${pass.id}/check-in`)
        .set('Cookie', merchant.cookie)
        .send({ method: 'MANUAL' }),
    ]);

    expect(responses.map(({ status }) => status).sort((a, b) => a - b)).toEqual(
      [201, 409],
    );
    expect(responses.find(({ status }) => status === 409)?.body).toMatchObject({
      code: 'PASS_ALREADY_CHECKED_IN',
    });
    await expect(
      prisma.checkIn.count({ where: { passId: pass.id } }),
    ).resolves.toBe(1);
    await expect(
      prisma.pass.findUniqueOrThrow({ where: { id: pass.id } }),
    ).resolves.toMatchObject({ status: 'CHECKED_IN' });
  });

  it('rejects an already checked-in pass with a conflict', async () => {
    const merchant = await signUpAs('merchant');
    const holder = await signUpAs('user');
    const pass = await createPass(merchant.userId, holder.userId);

    await request(app.getHttpServer())
      .post(`/passes/${pass.id}/check-in`)
      .set('Cookie', merchant.cookie)
      .send({ method: 'MANUAL' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post(`/passes/${pass.id}/check-in`)
      .set('Cookie', merchant.cookie)
      .send({ method: 'MANUAL' });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ code: 'PASS_ALREADY_CHECKED_IN' });
  });

  it('returns VALID when a merchant verifies an active pass for their event', async () => {
    const merchant = await signUpAs('merchant');
    const holder = await signUpAs('user');
    const pass = await createPass(merchant.userId, holder.userId);

    const response = await request(app.getHttpServer())
      .get(`/passes/${pass.id}/verify`)
      .set('Cookie', merchant.cookie);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      verificationStatus: 'VALID',
      onChainStatus: 'NOT_MINTED',
      canCheckIn: true,
      pass: {
        id: pass.id,
        status: 'ACTIVE',
        tokenId: null,
      },
      event: {
        id: pass.eventId,
        name: 'Check-in test event',
      },
      ticketType: {
        id: pass.ticketTypeId,
        name: 'General Pass',
      },
      holder: {
        id: holder.userId,
        name: 'user check-in test user',
        email: holder.email,
      },
      checkIn: null,
    });
  });

  it('returns ALREADY_CHECKED_IN with audit details after check-in', async () => {
    const merchant = await signUpAs('merchant');
    const holder = await signUpAs('user');
    const pass = await createPass(merchant.userId, holder.userId);

    await request(app.getHttpServer())
      .post(`/passes/${pass.id}/check-in`)
      .set('Cookie', merchant.cookie)
      .send({ method: 'MANUAL' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/passes/${pass.id}/verify`)
      .set('Cookie', merchant.cookie);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      verificationStatus: 'ALREADY_CHECKED_IN',
      canCheckIn: false,
      checkIn: { verifiedBy: { id: merchant.userId } },
    });
  });

  it('returns REVOKED for a revoked pass and refuses check-in', async () => {
    const merchant = await signUpAs('merchant');
    const holder = await signUpAs('user');
    const pass = await createPass(merchant.userId, holder.userId, 'REVOKED');

    const verification = await request(app.getHttpServer())
      .get(`/passes/${pass.id}/verify`)
      .set('Cookie', merchant.cookie);
    expect(verification.status).toBe(200);
    expect(verification.body).toMatchObject({
      verificationStatus: 'REVOKED',
      canCheckIn: false,
    });

    const checkIn = await request(app.getHttpServer())
      .post(`/passes/${pass.id}/check-in`)
      .set('Cookie', merchant.cookie)
      .send({ method: 'MANUAL' });
    expect(checkIn.status).toBe(409);
    expect(checkIn.body).toMatchObject({ code: 'PASS_REVOKED' });
  });

  it('enforces authentication, role, ownership, and not-found boundaries', async () => {
    const merchant = await signUpAs('merchant');
    const otherMerchant = await signUpAs('merchant');
    const holder = await signUpAs('user');
    const pass = await createPass(merchant.userId, holder.userId);

    await request(app.getHttpServer())
      .get(`/passes/${pass.id}/verify`)
      .expect(401);
    await request(app.getHttpServer())
      .get(`/passes/${pass.id}/verify`)
      .set('Cookie', holder.cookie)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/passes/${pass.id}/verify`)
      .set('Cookie', otherMerchant.cookie)
      .expect(403);
    await request(app.getHttpServer())
      .get('/passes/missing-pass/verify')
      .set('Cookie', merchant.cookie)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/passes/${pass.id}/check-in`)
      .send({ method: 'MANUAL' })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/passes/${pass.id}/check-in`)
      .set('Cookie', holder.cookie)
      .send({ method: 'MANUAL' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/passes/${pass.id}/check-in`)
      .set('Cookie', otherMerchant.cookie)
      .send({ method: 'MANUAL' })
      .expect(403);
  });

  it('allows an admin to verify and check in any pass', async () => {
    const merchant = await signUpAs('merchant');
    const admin = await signUpAs('admin');
    const holder = await signUpAs('user');
    const pass = await createPass(merchant.userId, holder.userId);

    await request(app.getHttpServer())
      .get(`/passes/${pass.id}/verify`)
      .set('Cookie', admin.cookie)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/passes/${pass.id}/check-in`)
      .set('Cookie', admin.cookie)
      .send({ method: 'MANUAL' })
      .expect(201);
  });

  it('rejects client-controlled verifier fields', async () => {
    const merchant = await signUpAs('merchant');
    const holder = await signUpAs('user');
    const pass = await createPass(merchant.userId, holder.userId);

    const response = await request(app.getHttpServer())
      .post(`/passes/${pass.id}/check-in`)
      .set('Cookie', merchant.cookie)
      .send({ method: 'MANUAL', verifiedById: holder.userId });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('reports VERIFIED for a minted pass owned by the bound wallet', async () => {
    verifyTokenOwner.mockResolvedValueOnce(true);
    const merchant = await signUpAs('merchant');
    const holder = await signUpAs('user');
    await prisma.wallet.create({
      data: {
        userId: holder.userId,
        address: `0x${randomBytes(20).toString('hex')}`,
        chainId: CHAINPASS_SEPOLIA_CHAIN_ID,
        verifiedAt: new Date(),
      },
    });
    const pass = await createPass(merchant.userId, holder.userId);
    await prisma.pass.update({
      where: { id: pass.id },
      data: {
        tokenId: '42',
        mintTxHash: `0x${randomBytes(32).toString('hex')}`,
        contractAddress: `0x${randomBytes(20).toString('hex')}`,
        chainId: CHAINPASS_SEPOLIA_CHAIN_ID,
      },
    });

    const response = await request(app.getHttpServer())
      .get(`/passes/${pass.id}/verify`)
      .set('Cookie', merchant.cookie);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ onChainStatus: 'VERIFIED' });
    expect(verifyTokenOwner).toHaveBeenCalledOnce();
  });

  it('keeps an active pass check-in eligible when RPC verification fails', async () => {
    verifyTokenOwner.mockRejectedValueOnce(new Error('RPC unavailable'));
    const merchant = await signUpAs('merchant');
    const holder = await signUpAs('user');
    await prisma.wallet.create({
      data: {
        userId: holder.userId,
        address: `0x${randomBytes(20).toString('hex')}`,
        chainId: CHAINPASS_SEPOLIA_CHAIN_ID,
        verifiedAt: new Date(),
      },
    });
    const pass = await createPass(merchant.userId, holder.userId);
    await prisma.pass.update({
      where: { id: pass.id },
      data: {
        tokenId: '43',
        mintTxHash: `0x${randomBytes(32).toString('hex')}`,
        contractAddress: `0x${randomBytes(20).toString('hex')}`,
        chainId: CHAINPASS_SEPOLIA_CHAIN_ID,
      },
    });

    const response = await request(app.getHttpServer())
      .get(`/passes/${pass.id}/verify`)
      .set('Cookie', merchant.cookie);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      verificationStatus: 'VALID',
      onChainStatus: 'UNAVAILABLE',
      canCheckIn: true,
    });
  });

  async function signUpAs(role: 'admin' | 'merchant' | 'user') {
    const email = `${testEmailPrefix}-${role}-${crypto.randomUUID()}@chainpass.local`;
    const name = `${role} check-in test user`;
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', 'http://localhost:3000')
      .send({ name, email, password: 'ChainPass123!' })
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

    if (!cookie) throw new Error('Better Auth did not return a session cookie');

    return { cookie, email, userId };
  }

  async function createPass(
    organizerId: string,
    ownerId: string,
    status: 'ACTIVE' | 'CHECKED_IN' | 'REVOKED' = 'ACTIVE',
  ) {
    const event = await prisma.event.create({
      data: {
        name: 'Check-in test event',
        location: 'Shanghai',
        startsAt: new Date('2026-12-01T01:00:00.000Z'),
        endsAt: new Date('2026-12-01T09:00:00.000Z'),
        status: 'PUBLISHED',
        organizerId,
      },
    });
    const ticketType = await prisma.ticketType.create({
      data: {
        eventId: event.id,
        name: 'General Pass',
        totalSupply: 100,
        claimedCount: 1,
      },
    });

    return prisma.pass.create({
      data: {
        eventId: event.id,
        ticketTypeId: ticketType.id,
        ownerId,
        status,
      },
    });
  }
});
