import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

import { AppModule } from '../src/app.module.js';
import { prisma } from '../src/lib/prisma.js';

describe('Wallet binding', () => {
  let app: INestApplication<App>;

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const testEmailPrefix = `wallet-binding-e2e-${runId}`;

  beforeAll(async () => {
    process.env.CHAIN_ID = '84532';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { startsWith: testEmailPrefix } },
    });
    await app.close();
  });

  it('requires authentication to create a challenge', async () => {
    const account = privateKeyToAccount(generatePrivateKey());

    await request(app.getHttpServer())
      .post('/wallets/challenge')
      .send({ address: account.address, chainId: 84532 })
      .expect(401);
  });

  it('returns JSON null when the current user has no bound wallet', async () => {
    const user = await signUpUser();
    const response = await request(app.getHttpServer())
      .get('/wallets/me')
      .set('Cookie', user.cookie)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toBeNull();
  });

  it('binds the wallet that signed the current user challenge', async () => {
    const user = await signUpUser();
    const account = privateKeyToAccount(generatePrivateKey());
    const challenge = await createChallenge(user.cookie, account.address);
    const signature = await account.signMessage({
      message: challenge.message as string,
    });

    const verified = await request(app.getHttpServer())
      .post('/wallets/verify')
      .set('Cookie', user.cookie)
      .send({
        challengeId: challenge.id,
        address: account.address.toLowerCase(),
        signature,
      })
      .expect(201);

    expect(verified.body).toMatchObject({
      address: account.address,
      chainId: 84532,
    });

    const currentWallet = await request(app.getHttpServer())
      .get('/wallets/me')
      .set('Cookie', user.cookie)
      .expect(200);

    expect(currentWallet.body).toEqual(verified.body);
  });

  it('rejects a signature produced by a different wallet', async () => {
    const user = await signUpUser();
    const requestedAccount = privateKeyToAccount(generatePrivateKey());
    const signingAccount = privateKeyToAccount(generatePrivateKey());
    const challenge = await createChallenge(
      user.cookie,
      requestedAccount.address,
    );
    const signature = await signingAccount.signMessage({
      message: challenge.message as string,
    });

    const response = await request(app.getHttpServer())
      .post('/wallets/verify')
      .set('Cookie', user.cookie)
      .send({
        challengeId: challenge.id,
        address: requestedAccount.address,
        signature,
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_WALLET_SIGNATURE');
    await expectNoWallet(user.userId);
  });

  it('rejects an expired challenge', async () => {
    const user = await signUpUser();
    const account = privateKeyToAccount(generatePrivateKey());
    const challenge = await createChallenge(user.cookie, account.address);
    const signature = await account.signMessage({
      message: challenge.message as string,
    });

    await prisma.walletChallenge.update({
      where: { id: challenge.id as string },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    const response = await request(app.getHttpServer())
      .post('/wallets/verify')
      .set('Cookie', user.cookie)
      .send({
        challengeId: challenge.id,
        address: account.address,
        signature,
      });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('WALLET_CHALLENGE_EXPIRED');
    await expectNoWallet(user.userId);
  });

  it('consumes a challenge after one successful verification', async () => {
    const user = await signUpUser();
    const account = privateKeyToAccount(generatePrivateKey());
    const challenge = await createChallenge(user.cookie, account.address);
    const signature = await account.signMessage({
      message: challenge.message as string,
    });
    const body = {
      challengeId: challenge.id,
      address: account.address,
      signature,
    };

    await request(app.getHttpServer())
      .post('/wallets/verify')
      .set('Cookie', user.cookie)
      .send(body)
      .expect(201);

    const replay = await request(app.getHttpServer())
      .post('/wallets/verify')
      .set('Cookie', user.cookie)
      .send(body);

    expect(replay.status).toBe(409);
    expect(replay.body.code).toBe('WALLET_CHALLENGE_USED');
  });

  it('prevents one wallet from being bound to two users', async () => {
    const firstUser = await signUpUser();
    const secondUser = await signUpUser();
    const account = privateKeyToAccount(generatePrivateKey());

    await bindWallet(firstUser.cookie, account);

    const challenge = await createChallenge(secondUser.cookie, account.address);
    const signature = await account.signMessage({
      message: challenge.message as string,
    });
    const collision = await request(app.getHttpServer())
      .post('/wallets/verify')
      .set('Cookie', secondUser.cookie)
      .send({
        challengeId: challenge.id,
        address: account.address,
        signature,
      });

    expect(collision.status).toBe(409);
    expect(collision.body.code).toBe('WALLET_ADDRESS_ALREADY_BOUND');
    await expectNoWallet(secondUser.userId);
  });

  it('does not accept a client-supplied user identity', async () => {
    const user = await signUpUser();
    const account = privateKeyToAccount(generatePrivateKey());

    const response = await request(app.getHttpServer())
      .post('/wallets/challenge')
      .set('Cookie', user.cookie)
      .send({
        address: account.address,
        chainId: 84532,
        userId: 'client-controlled-user-id',
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  async function signUpUser() {
    const email = `${testEmailPrefix}-${crypto.randomUUID()}@chainpass.local`;
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', 'http://localhost:3000')
      .send({
        name: 'wallet binding test user',
        email,
        password: 'ChainPass123!',
      })
      .expect(200);

    const cookieHeader = response.headers['set-cookie'];
    const cookie = Array.isArray(cookieHeader)
      ? cookieHeader.map((value) => value.split(';')[0]).join('; ')
      : cookieHeader;

    if (!cookie) throw new Error('Better Auth did not return a session cookie');

    return { cookie, userId: response.body.user.id as string };
  }

  async function createChallenge(cookie: string, address: string) {
    const response = await request(app.getHttpServer())
      .post('/wallets/challenge')
      .set('Cookie', cookie)
      .send({ address, chainId: 84532 })
      .expect(201);

    return response.body as { id: string; message: string };
  }

  async function bindWallet(
    cookie: string,
    account: ReturnType<typeof privateKeyToAccount>,
  ) {
    const challenge = await createChallenge(cookie, account.address);
    const signature = await account.signMessage({
      message: challenge.message,
    });

    await request(app.getHttpServer())
      .post('/wallets/verify')
      .set('Cookie', cookie)
      .send({
        challengeId: challenge.id,
        address: account.address,
        signature,
      })
      .expect(201);
  }

  async function expectNoWallet(userId: string) {
    await expect(prisma.wallet.findUnique({ where: { userId } })).resolves.toBe(
      null,
    );
  }
});
