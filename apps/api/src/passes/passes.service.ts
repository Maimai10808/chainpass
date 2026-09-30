import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ClaimPassResult,
  MintPassResult,
  PassView,
} from '@chainpass/schemas';

import { BlockchainService } from '../blockchain/blockchain.service.js';
import { prisma } from '../database/prisma.js';
import { Prisma } from '../generated/prisma/client.js';

type PassWithDetails = Prisma.PassGetPayload<{
  include: { event: true; ticketType: true };
}>;

@Injectable()
export class PassesService {
  constructor(private readonly blockchainService: BlockchainService) {}

  async claim(ticketTypeId: string, ownerId: string): Promise<ClaimPassResult> {
    try {
      return await prisma.$transaction(async (transaction) => {
        const ticketType = await transaction.ticketType.findUnique({
          where: { id: ticketTypeId },
          include: { event: true },
        });

        if (!ticketType) {
          throw new NotFoundException({
            code: 'TICKET_TYPE_NOT_FOUND',
            message: 'Ticket type not found',
          });
        }

        if (ticketType.event.status !== 'PUBLISHED') {
          throw new ConflictException({
            code: 'EVENT_NOT_PUBLISHED',
            message: 'Passes can only be claimed from published events',
          });
        }

        if (ticketType.status !== 'ACTIVE') {
          throw new ConflictException({
            code: 'TICKET_TYPE_INACTIVE',
            message: 'This ticket type is not active',
          });
        }

        const existingPass = await transaction.pass.findUnique({
          where: {
            ticketTypeId_ownerId: { ticketTypeId, ownerId },
          },
          select: { id: true },
        });

        if (existingPass) {
          throw new ConflictException({
            code: 'PASS_ALREADY_CLAIMED',
            message: 'You already claimed this pass',
          });
        }

        const inventory = await transaction.$queryRaw<
          Array<{ claimedCount: number; totalSupply: number }>
        >`
          UPDATE "TicketType"
          SET "claimedCount" = "claimedCount" + 1,
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE "id" = ${ticketTypeId}
            AND "status" = 'ACTIVE'
            AND "claimedCount" < "totalSupply"
          RETURNING "claimedCount", "totalSupply"
        `;

        const updatedInventory = inventory[0];
        if (!updatedInventory) {
          throw new ConflictException({
            code: 'TICKET_TYPE_SOLD_OUT',
            message: 'This ticket type is sold out',
          });
        }

        const pass = await transaction.pass.create({
          data: {
            eventId: ticketType.eventId,
            ticketTypeId,
            ownerId,
          },
          include: { event: true, ticketType: true },
        });

        return {
          pass: this.toView(pass),
          remaining:
            updatedInventory.totalSupply - updatedInventory.claimedCount,
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'PASS_ALREADY_CLAIMED',
          message: 'You already claimed this pass',
        });
      }

      throw error;
    }
  }

  async getMine(ownerId: string): Promise<PassView[]> {
    const passes = await prisma.pass.findMany({
      where: { ownerId },
      include: { event: true, ticketType: true },
      orderBy: { createdAt: 'desc' },
    });

    return passes.map((pass) => this.toView(pass));
  }

  async mint(passId: string, ownerId: string): Promise<MintPassResult> {
    return prisma.$transaction(
      async (transaction) => {
        await transaction.$queryRaw<Array<{ locked: boolean }>>`
          SELECT pg_advisory_xact_lock(hashtextextended(${passId}, 0)) IS NULL AS locked
        `;

        const pass = await transaction.pass.findUnique({
          where: { id: passId },
          include: {
            event: true,
            ticketType: true,
            owner: { include: { wallet: true } },
          },
        });

        if (!pass) {
          throw new NotFoundException({
            code: 'PASS_NOT_FOUND',
            message: 'Pass not found',
          });
        }

        if (pass.ownerId !== ownerId) {
          throw new ForbiddenException({
            code: 'PASS_NOT_OWNED',
            message: 'You can only mint your own pass',
          });
        }

        if (pass.status !== 'ACTIVE') {
          throw new ConflictException({
            code: 'PASS_NOT_ACTIVE',
            message: 'Only an active pass can be minted',
          });
        }

        if (!pass.owner.wallet) {
          throw new ConflictException({
            code: 'WALLET_NOT_BOUND',
            message: 'Bind and verify a wallet before minting',
          });
        }

        if (
          pass.tokenId &&
          pass.mintTxHash &&
          pass.contractAddress &&
          pass.chainId
        ) {
          return { pass: this.toView(pass), recovered: false };
        }

        const minted = await this.blockchainService.mintPass(
          pass.id,
          pass.owner.wallet.address,
        );
        const updatedPass = await transaction.pass.update({
          where: { id: pass.id },
          data: {
            tokenId: minted.tokenId,
            mintTxHash: minted.transactionHash,
            contractAddress: minted.contractAddress,
            chainId: minted.chainId,
          },
          include: { event: true, ticketType: true },
        });

        return {
          pass: this.toView(updatedPass),
          recovered: minted.recovered,
        };
      },
      { maxWait: 10_000, timeout: 120_000 },
    );
  }

  private toView(pass: PassWithDetails): PassView {
    return {
      id: pass.id,
      status: pass.status,
      tokenId: pass.tokenId,
      mintTxHash: pass.mintTxHash,
      contractAddress: pass.contractAddress,
      chainId: pass.chainId,
      onChainStatus:
        pass.tokenId && pass.mintTxHash && pass.contractAddress && pass.chainId
          ? 'ON_CHAIN_VERIFIED'
          : 'OFF_CHAIN',
      createdAt: pass.createdAt.toISOString(),
      event: {
        id: pass.event.id,
        name: pass.event.name,
        location: pass.event.location,
        startsAt: pass.event.startsAt.toISOString(),
        endsAt: pass.event.endsAt.toISOString(),
      },
      ticketType: {
        id: pass.ticketType.id,
        name: pass.ticketType.name,
        price: pass.ticketType.price.toString(),
      },
    };
  }
}
