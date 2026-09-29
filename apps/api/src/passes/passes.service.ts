import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ClaimPassResult, PassView } from '@chainpass/schemas';

import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';

type PassWithDetails = Prisma.PassGetPayload<{
  include: { event: true; ticketType: true };
}>;

@Injectable()
export class PassesService {
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

  private toView(pass: PassWithDetails): PassView {
    return {
      id: pass.id,
      status: pass.status,
      tokenId: pass.tokenId,
      mintTxHash: pass.mintTxHash,
      contractAddress: pass.contractAddress,
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
