import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateInvitationInput,
  CreateInvitationResponse,
  InvitationPreview,
  InvitationView,
} from '@chainpass/schemas';
import { prisma } from '../database/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';

type Actor = { id: string; role?: string | null };
type StoredInvitation = Prisma.InvitationGetPayload<{
  include: {
    ticketType: {
      include: {
        event: { include: { organizer: { select: { name: true } } } };
      };
    };
  };
}>;
const include = {
  ticketType: {
    include: { event: { include: { organizer: { select: { name: true } } } } },
  },
} as const;
const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class InvitationsService {
  async create(
    eventId: string,
    input: CreateInvitationInput,
    actor: Actor,
  ): Promise<CreateInvitationResponse> {
    const event = await this.ownedEvent(eventId, actor);
    if (event.accessMode !== 'INVITE_ONLY' || event.status !== 'PUBLISHED') {
      throw new ConflictException({
        code: 'INVITATION_UNAVAILABLE',
        message: 'Publish an invitation-only event before creating invitations',
      });
    }
    const ticketType = await prisma.ticketType.findFirst({
      where: { id: input.ticketTypeId, eventId, status: 'ACTIVE' },
    });
    if (!ticketType)
      throw new BadRequestException({
        code: 'INVALID_TICKET_TYPE',
        message: 'Choose an active ticket type belonging to this event',
      });
    if (new Date(input.expiresAt) <= new Date())
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invitation expiry must be in the future',
      });
    const token = randomBytes(32).toString('base64url');
    const invitation = await prisma.invitation.create({
      data: {
        ticketTypeId: ticketType.id,
        tokenHash: hashToken(token),
        createdById: actor.id,
        maxUses: input.maxUses,
        expiresAt: new Date(input.expiresAt),
      },
      include,
    });
    return { invitation: this.view(invitation), token };
  }

  async list(eventId: string, actor: Actor): Promise<InvitationView[]> {
    await this.ownedEvent(eventId, actor);
    const rows = await prisma.invitation.findMany({
      where: { ticketType: { eventId } },
      include,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.view(row));
  }

  async revoke(invitationId: string, actor: Actor): Promise<InvitationView> {
    const row = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include,
    });
    if (!row)
      throw new NotFoundException({
        code: 'INVITATION_NOT_FOUND',
        message: 'Invitation not found',
      });
    await this.ownedEvent(row.ticketType.eventId, actor);
    // Locks the same row as claim consumption. A completed claim remains a valid Pass.
    await prisma.invitation.updateMany({
      where: { id: invitationId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return this.view(
      await prisma.invitation.findUniqueOrThrow({
        where: { id: invitationId },
        include,
      }),
    );
  }

  async resolve(token: string): Promise<InvitationPreview> {
    const row = await prisma.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include,
    });
    this.assertUsable(row);
    const type = row.ticketType;
    const event = type.event;
    return {
      event: {
        id: event.id,
        name: event.name,
        description: event.description,
        coverImageUrl: event.coverImageUrl,
        location: event.location,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        status: 'PUBLISHED',
        organizer: { name: event.organizer.name },
      },
      ticketType: {
        id: type.id,
        name: type.name,
        description: type.description,
        price: type.price.toString(),
        totalSupply: type.totalSupply,
        claimedCount: type.claimedCount,
        remaining: type.totalSupply - type.claimedCount,
        status: 'ACTIVE',
      },
      expiresAt: row.expiresAt.toISOString(),
      remainingUses: row.maxUses - row.usedCount,
    };
  }

  /** Called only inside the existing claim transaction: rollback also restores this quota. */
  async consume(
    transaction: Prisma.TransactionClient,
    token: string,
    ticketTypeId: string,
  ): Promise<string> {
    const row = await transaction.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include,
    });
    if (!row || row.ticketTypeId !== ticketTypeId) this.invalid();
    this.assertUsable(row);
    const updated = await transaction.$queryRaw<Array<{ id: string }>>`
      UPDATE "Invitation" SET "usedCount" = "usedCount" + 1
      WHERE "id" = ${row.id} AND "revokedAt" IS NULL
        AND "expiresAt" > clock_timestamp() AND "usedCount" < "maxUses"
      RETURNING "id"
    `;
    if (!updated.length) {
      // A concurrent revoke/claim may have changed eligibility since the initial read.
      this.assertUsable(
        await transaction.invitation.findUnique({
          where: { id: row.id },
          include,
        }),
      );
      this.invalid();
    }
    return row.id;
  }

  private assertUsable(
    row: StoredInvitation | null,
  ): asserts row is StoredInvitation {
    if (!row) this.invalid();
    if (row.revokedAt)
      throw new ConflictException({
        code: 'INVITATION_REVOKED',
        message:
          'This invitation was revoked. Ask the organizer for a new link.',
      });
    if (row.expiresAt <= new Date())
      throw new ConflictException({
        code: 'INVITATION_EXPIRED',
        message: 'This invitation expired. Ask the organizer for a new link.',
      });
    if (row.usedCount >= row.maxUses)
      throw new ConflictException({
        code: 'INVITATION_EXHAUSTED',
        message: 'This invitation has reached its claim limit.',
      });
    if (
      row.ticketType.event.status !== 'PUBLISHED' ||
      row.ticketType.event.accessMode !== 'INVITE_ONLY' ||
      row.ticketType.status !== 'ACTIVE'
    ) {
      throw new ConflictException({
        code: 'INVITATION_UNAVAILABLE',
        message: 'This invitation is not available.',
      });
    }
  }

  private invalid(): never {
    throw new BadRequestException({
      code: 'INVALID_INVITATION',
      message: 'Invalid invitation. Ask the organizer for a new link.',
    });
  }

  private async ownedEvent(id: string, actor: Actor) {
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event)
      throw new NotFoundException({
        code: 'EVENT_NOT_FOUND',
        message: 'Event not found',
      });
    if (actor.role !== 'admin' && event.organizerId !== actor.id)
      throw new ForbiddenException({
        code: 'EVENT_OWNERSHIP_REQUIRED',
        message: 'Only the event organizer can manage invitations',
      });
    return event;
  }

  private view(row: StoredInvitation): InvitationView {
    return {
      id: row.id,
      ticketTypeId: row.ticketTypeId,
      ticketTypeName: row.ticketType.name,
      maxUses: row.maxUses,
      usedCount: row.usedCount,
      expiresAt: row.expiresAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
