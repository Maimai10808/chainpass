import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CheckInInput,
  CheckInResponse,
  PassVerificationOnChainStatus,
  VerificationStatus,
  VerifyPassResponse,
} from '@chainpass/schemas';

import { BlockchainService } from '../blockchain/blockchain.service.js';
import { prisma } from '../database/prisma.js';
import { Prisma } from '../generated/prisma/client.js';

const passDetails = {
  event: true,
  ticketType: true,
  owner: { include: { wallet: true } },
  checkIn: { include: { verifiedBy: true } },
} satisfies Prisma.PassInclude;

type PassWithDetails = Prisma.PassGetPayload<{ include: typeof passDetails }>;

@Injectable()
export class CheckInsService {
  constructor(private readonly blockchainService: BlockchainService) {}

  async verify(
    passId: string,
    verifier: { id: string; role?: string | null },
  ): Promise<VerifyPassResponse> {
    const pass = await prisma.pass.findUnique({
      where: { id: passId },
      include: {
        event: true,
        ticketType: true,
        owner: { include: { wallet: true } },
        checkIn: { include: { verifiedBy: true } },
      },
    });

    if (!pass) {
      throw new NotFoundException({
        code: 'PASS_NOT_FOUND',
        message: 'Pass not found',
      });
    }

    if (verifier.role !== 'admin' && pass.event.organizerId !== verifier.id) {
      throw new ForbiddenException({
        code: 'EVENT_OWNERSHIP_REQUIRED',
        message: 'Only the event organizer can verify this pass',
      });
    }

    return this.toResponse(pass);
  }

  async checkIn(
    passId: string,
    input: CheckInInput,
    verifier: { id: string; role?: string | null },
  ): Promise<CheckInResponse> {
    try {
      const pass = await prisma.$transaction(async (transaction) => {
        const current = await transaction.pass.findUnique({
          where: { id: passId },
          include: passDetails,
        });

        if (!current) {
          throw new NotFoundException({
            code: 'PASS_NOT_FOUND',
            message: 'Pass not found',
          });
        }

        this.assertOwnership(current.event.organizerId, verifier);

        if (current.ticketType.eventId !== current.eventId) {
          throw new ConflictException({
            code: 'PASS_INVALID',
            message: 'Pass event and ticket type are inconsistent',
          });
        }

        if (current.status === 'CHECKED_IN' || current.checkIn) {
          throw this.alreadyCheckedIn();
        }

        if (current.status === 'REVOKED') {
          throw new ConflictException({
            code: 'PASS_REVOKED',
            message: 'A revoked pass cannot be checked in',
          });
        }

        const updated = await transaction.pass.updateMany({
          where: { id: passId, status: 'ACTIVE' },
          data: { status: 'CHECKED_IN' },
        });

        if (updated.count !== 1) throw this.alreadyCheckedIn();

        await transaction.checkIn.create({
          data: {
            passId,
            eventId: current.eventId,
            verifiedById: verifier.id,
            method: input.method,
          },
        });

        return transaction.pass.findUniqueOrThrow({
          where: { id: passId },
          include: passDetails,
        });
      });

      return this.toResponse(pass);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw this.alreadyCheckedIn();
      }

      throw error;
    }
  }

  private async toResponse(pass: PassWithDetails): Promise<VerifyPassResponse> {
    const relationshipIsValid = pass.ticketType.eventId === pass.eventId;
    const verificationStatus: VerificationStatus = !relationshipIsValid
      ? 'INVALID'
      : pass.status === 'CHECKED_IN' || pass.checkIn
        ? 'ALREADY_CHECKED_IN'
        : pass.status === 'REVOKED'
          ? 'REVOKED'
          : 'VALID';
    const hasAnyMintMetadata = Boolean(
      pass.tokenId || pass.mintTxHash || pass.contractAddress || pass.chainId,
    );
    let onChainStatus: PassVerificationOnChainStatus = hasAnyMintMetadata
      ? 'UNAVAILABLE'
      : 'NOT_MINTED';

    if (
      pass.tokenId &&
      pass.mintTxHash &&
      pass.contractAddress &&
      pass.chainId
    ) {
      if (!pass.owner.wallet) {
        onChainStatus = 'MISMATCH';
      } else {
        try {
          const ownerMatches = await this.blockchainService.verifyTokenOwner({
            chainId: pass.chainId,
            contractAddress: pass.contractAddress,
            tokenId: pass.tokenId,
            expectedOwner: pass.owner.wallet.address,
          });
          onChainStatus = ownerMatches ? 'VERIFIED' : 'MISMATCH';
        } catch {
          onChainStatus = 'UNAVAILABLE';
        }
      }
    }

    return {
      verificationStatus,
      onChainStatus,
      canCheckIn: verificationStatus === 'VALID',
      pass: {
        id: pass.id,
        status: pass.status,
        tokenId: pass.tokenId,
        mintTxHash: pass.mintTxHash,
        contractAddress: pass.contractAddress,
        chainId: pass.chainId,
        createdAt: pass.createdAt.toISOString(),
      },
      event: {
        id: pass.event.id,
        name: pass.event.name,
        startsAt: pass.event.startsAt.toISOString(),
        location: pass.event.location,
      },
      ticketType: {
        id: pass.ticketType.id,
        name: pass.ticketType.name,
      },
      holder: {
        id: pass.owner.id,
        name: pass.owner.name,
        email: pass.owner.email,
      },
      checkIn: pass.checkIn
        ? {
            id: pass.checkIn.id,
            method: pass.checkIn.method,
            verifiedAt: pass.checkIn.verifiedAt.toISOString(),
            verifiedBy: {
              id: pass.checkIn.verifiedBy.id,
              name: pass.checkIn.verifiedBy.name,
              email: pass.checkIn.verifiedBy.email,
            },
          }
        : null,
    };
  }

  private assertOwnership(
    organizerId: string,
    verifier: { id: string; role?: string | null },
  ): void {
    if (verifier.role !== 'admin' && organizerId !== verifier.id) {
      throw new ForbiddenException({
        code: 'EVENT_OWNERSHIP_REQUIRED',
        message: 'Only the event organizer can verify this pass',
      });
    }
  }

  private alreadyCheckedIn(): ConflictException {
    return new ConflictException({
      code: 'PASS_ALREADY_CHECKED_IN',
      message: 'This pass has already been checked in',
    });
  }
}
