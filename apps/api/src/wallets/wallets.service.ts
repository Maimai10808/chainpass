import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateWalletChallengeInput,
  VerifyWalletInput,
  WalletChallengeResponse,
  WalletView,
} from '@chainpass/schemas';
import { canonicalizeEvmAddress } from '@chainpass/web3';
import { recoverMessageAddress, type Hex } from 'viem';

import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class WalletsService {
  async createChallenge(
    userId: string,
    input: CreateWalletChallengeInput,
  ): Promise<WalletChallengeResponse> {
    const address = this.canonicalizeAddress(input.address);
    const expectedChainId = this.getChainId();

    if (input.chainId !== expectedChainId) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_CHAIN',
        message: `Connect a wallet on chain ${expectedChainId}`,
      });
    }

    const existingWallet = await prisma.wallet.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (existingWallet) {
      throw new ConflictException({
        code: 'WALLET_ALREADY_BOUND',
        message: 'This account already has a verified wallet',
      });
    }

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);
    const nonce = crypto.randomUUID();
    const message = this.createMessage({
      userId,
      address,
      chainId: input.chainId,
      nonce,
      issuedAt,
      expiresAt,
    });

    const challenge = await prisma.walletChallenge.create({
      data: {
        userId,
        address,
        chainId: input.chainId,
        nonce,
        message,
        expiresAt,
      },
    });

    return {
      id: challenge.id,
      address: challenge.address,
      chainId: challenge.chainId,
      message: challenge.message,
      expiresAt: challenge.expiresAt.toISOString(),
    };
  }

  async verify(userId: string, input: VerifyWalletInput): Promise<WalletView> {
    const address = this.canonicalizeAddress(input.address);
    const challenge = await prisma.walletChallenge.findFirst({
      where: { id: input.challengeId, userId },
    });

    if (!challenge) {
      throw new NotFoundException({
        code: 'WALLET_CHALLENGE_NOT_FOUND',
        message: 'Wallet challenge not found',
      });
    }

    if (challenge.usedAt) {
      throw new ConflictException({
        code: 'WALLET_CHALLENGE_USED',
        message: 'Wallet challenge has already been used',
      });
    }

    if (challenge.expiresAt <= new Date()) {
      throw new ConflictException({
        code: 'WALLET_CHALLENGE_EXPIRED',
        message: 'Wallet challenge has expired',
      });
    }

    if (challenge.address !== address) {
      throw new BadRequestException({
        code: 'WALLET_CHALLENGE_MISMATCH',
        message: 'Wallet address does not match the challenge',
      });
    }

    let recoveredAddress: string;
    try {
      recoveredAddress = canonicalizeEvmAddress(
        await recoverMessageAddress({
          message: challenge.message,
          signature: input.signature as Hex,
        }),
      );
    } catch {
      throw new BadRequestException({
        code: 'INVALID_WALLET_SIGNATURE',
        message: 'Wallet signature is invalid',
      });
    }

    if (recoveredAddress !== address) {
      throw new BadRequestException({
        code: 'INVALID_WALLET_SIGNATURE',
        message: 'Wallet signature does not match the requested address',
      });
    }

    try {
      const wallet = await prisma.$transaction(async (transaction) => {
        const consumed = await transaction.walletChallenge.updateMany({
          where: {
            id: challenge.id,
            userId,
            address,
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { usedAt: new Date() },
        });

        if (consumed.count !== 1) {
          throw new ConflictException({
            code: 'WALLET_CHALLENGE_UNAVAILABLE',
            message: 'Wallet challenge is no longer available',
          });
        }

        return transaction.wallet.create({
          data: {
            userId,
            address,
            chainId: challenge.chainId,
            verifiedAt: new Date(),
          },
        });
      });

      return this.toView(wallet);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const userWallet = await prisma.wallet.findUnique({
          where: { userId },
        });
        throw new ConflictException(
          userWallet
            ? {
                code: 'WALLET_ALREADY_BOUND',
                message: 'This account already has a verified wallet',
              }
            : {
                code: 'WALLET_ADDRESS_ALREADY_BOUND',
                message: 'This wallet is already bound to another account',
              },
        );
      }

      throw error;
    }
  }

  async getMine(userId: string): Promise<WalletView | null> {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    return wallet ? this.toView(wallet) : null;
  }

  private canonicalizeAddress(address: string): string {
    try {
      return canonicalizeEvmAddress(address);
    } catch {
      throw new BadRequestException({
        code: 'INVALID_WALLET_ADDRESS',
        message: 'Wallet address is invalid',
      });
    }
  }

  private getChainId(): number {
    const chainId = Number(process.env.CHAIN_ID ?? '84532');
    if (!Number.isSafeInteger(chainId) || chainId <= 0) {
      throw new Error('CHAIN_ID must be a positive integer');
    }
    return chainId;
  }

  private createMessage(input: {
    userId: string;
    address: string;
    chainId: number;
    nonce: string;
    issuedAt: Date;
    expiresAt: Date;
  }): string {
    return [
      'ChainPass Wallet Binding',
      '',
      `User: ${input.userId}`,
      `Wallet: ${input.address}`,
      `Chain ID: ${input.chainId}`,
      `Nonce: ${input.nonce}`,
      `Issued At: ${input.issuedAt.toISOString()}`,
      `Expires At: ${input.expiresAt.toISOString()}`,
    ].join('\n');
  }

  private toView(wallet: {
    id: string;
    address: string;
    chainId: number;
    verifiedAt: Date;
  }): WalletView {
    return {
      id: wallet.id,
      address: wallet.address,
      chainId: wallet.chainId,
      verifiedAt: wallet.verifiedAt.toISOString(),
    };
  }
}
