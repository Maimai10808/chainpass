import {
  ServiceUnavailableException,
  type INestApplication,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

import {
  BlockchainService,
  type OnChainMintResult,
} from '../src/blockchain/blockchain.service.js';
import { AppModule } from '../src/app.module.js';
import { prisma } from '../src/database/prisma.js';

describe('Pass minting', () => {
  let app: INestApplication<App>;
  let shouldFail = false;
  let mintCounter = 0;
  const mintCalls: Array<{ passId: string; recipient: string }> = [];

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const testEmailPrefix = `pass-minting-e2e-${runId}`;
  const contractAddress = '0x1000000000000000000000000000000000000001';
  const fakeBlockchain = {
    isConfigured: () => true,
    mintPass: async (
      passId: string,
      recipient: string,
    ): Promise<OnChainMintResult> => {
      mintCalls.push({ passId, recipient });
      if (shouldFail) {
        throw new ServiceUnavailableException({
          code: 'MINT_TRANSACTION_FAILED',
          message: 'The mint transaction failed',
        });
      }

      mintCounter += 1;
      return {
        chainId: 84532,
        contractAddress,
        recovered: false,
        tokenId: String(mintCounter),
        transactionHash: `0x${mintCounter.toString(16).padStart(64, '0')}`,
      };
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(BlockchainService)
      .useValue(fakeBlockchain)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    shouldFail = false;
    mintCalls.length = 0;
  });

  afterAll(async () => {
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
  });

  it('mints an active owned pass to the verified bound wallet', async () => {
    const owner = await signUpUser();
    const walletAddress = await bindWallet(owner.userId);
    const pass = await createPass(owner.userId);

    const response = await request(app.getHttpServer())
      .post(`/passes/${pass.id}/mint`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(response.body).toMatchObject({
      recovered: false,
      pass: {
        id: pass.id,
        tokenId: expect.any(String),
        mintTxHash: expect.stringMatching(/^0x[0-9a-f]{64}$/),
        contractAddress,
        chainId: 84532,
        onChainStatus: 'ON_CHAIN_VERIFIED',
      },
    });
    expect(mintCalls).toEqual([{ passId: pass.id, recipient: walletAddress }]);

    const persisted = await prisma.pass.findUniqueOrThrow({
      where: { id: pass.id },
    });
    expect(persisted).toMatchObject({
      tokenId: response.body.pass.tokenId,
      mintTxHash: response.body.pass.mintTxHash,
      contractAddress,
      chainId: 84532,
    });
  });

  it('requires authentication', async () => {
    const owner = await signUpUser();
    await bindWallet(owner.userId);
    const pass = await createPass(owner.userId);

    await request(app.getHttpServer())
      .post(`/passes/${pass.id}/mint`)
      .expect(401);
    expect(mintCalls).toHaveLength(0);
  });

  it('forbids minting another user pass', async () => {
    const owner = await signUpUser();
    const attacker = await signUpUser();
    await bindWallet(owner.userId);
    await bindWallet(attacker.userId);
    const pass = await createPass(owner.userId);

    const response = await request(app.getHttpServer())
      .post(`/passes/${pass.id}/mint`)
      .set('Cookie', attacker.cookie);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('PASS_NOT_OWNED');
    expect(mintCalls).toHaveLength(0);
  });

  it('requires a verified bound wallet', async () => {
    const owner = await signUpUser();
    const pass = await createPass(owner.userId);

    const response = await request(app.getHttpServer())
      .post(`/passes/${pass.id}/mint`)
      .set('Cookie', owner.cookie);

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('WALLET_NOT_BOUND');
    expect(mintCalls).toHaveLength(0);
  });

  it('does not submit a second transaction for an already minted pass', async () => {
    const owner = await signUpUser();
    await bindWallet(owner.userId);
    const pass = await createPass(owner.userId);

    const first = await request(app.getHttpServer())
      .post(`/passes/${pass.id}/mint`)
      .set('Cookie', owner.cookie)
      .expect(200);
    const second = await request(app.getHttpServer())
      .post(`/passes/${pass.id}/mint`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(second.body).toEqual(first.body);
    expect(mintCalls).toHaveLength(1);
  });

  it('leaves the database unminted when the blockchain transaction fails', async () => {
    const owner = await signUpUser();
    await bindWallet(owner.userId);
    const pass = await createPass(owner.userId);
    shouldFail = true;

    const response = await request(app.getHttpServer())
      .post(`/passes/${pass.id}/mint`)
      .set('Cookie', owner.cookie);

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('MINT_TRANSACTION_FAILED');
    const persisted = await prisma.pass.findUniqueOrThrow({
      where: { id: pass.id },
    });
    expect(persisted).toMatchObject({
      tokenId: null,
      mintTxHash: null,
      contractAddress: null,
      chainId: null,
    });
  });

  it('rejects a non-active pass before submitting a transaction', async () => {
    const owner = await signUpUser();
    await bindWallet(owner.userId);
    const pass = await createPass(owner.userId, 'REVOKED');

    const response = await request(app.getHttpServer())
      .post(`/passes/${pass.id}/mint`)
      .set('Cookie', owner.cookie);

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('PASS_NOT_ACTIVE');
    expect(mintCalls).toHaveLength(0);
  });

  async function signUpUser() {
    const email = `${testEmailPrefix}-${crypto.randomUUID()}@chainpass.local`;
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Origin', 'http://localhost:3000')
      .send({
        name: 'pass minting test user',
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

  async function bindWallet(userId: string) {
    const address = privateKeyToAccount(generatePrivateKey()).address;
    await prisma.wallet.create({
      data: { userId, address, chainId: 84532, verifiedAt: new Date() },
    });
    return address;
  }

  async function createPass(
    ownerId: string,
    status: 'ACTIVE' | 'REVOKED' = 'ACTIVE',
  ) {
    const event = await prisma.event.create({
      data: {
        name: 'Pass minting test event',
        startsAt: new Date('2026-11-01T01:00:00.000Z'),
        endsAt: new Date('2026-11-01T09:00:00.000Z'),
        status: 'PUBLISHED',
        organizerId: ownerId,
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
