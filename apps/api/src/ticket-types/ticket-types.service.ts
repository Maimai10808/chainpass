import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateTicketTypeInput,
  TicketTypeResponse,
} from '@chainpass/schemas';

import { prisma } from '../lib/prisma.js';

@Injectable()
export class TicketTypesService {
  async create(
    eventId: string,
    input: CreateTicketTypeInput,
    user: { id: string; role?: string | null },
  ): Promise<TicketTypeResponse> {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { organizerId: true },
    });

    if (!event) {
      throw new NotFoundException({
        code: 'EVENT_NOT_FOUND',
        message: 'Event not found',
      });
    }

    if (user.role !== 'admin' && event.organizerId !== user.id) {
      throw new ForbiddenException({
        code: 'EVENT_OWNERSHIP_REQUIRED',
        message: 'Only the event organizer can create ticket types',
      });
    }

    const ticketType = await prisma.ticketType.create({
      data: {
        eventId,
        name: input.name,
        description: input.description,
        price: BigInt(input.price),
        totalSupply: input.totalSupply,
      },
    });

    return this.toResponse(ticketType);
  }

  async list(eventId: string): Promise<TicketTypeResponse[]> {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });

    if (!event) {
      throw new NotFoundException({
        code: 'EVENT_NOT_FOUND',
        message: 'Event not found',
      });
    }

    const ticketTypes = await prisma.ticketType.findMany({
      where: { eventId },
      orderBy: { createdAt: 'asc' },
    });

    return ticketTypes.map((ticketType) => this.toResponse(ticketType));
  }

  private toResponse(ticketType: {
    id: string;
    eventId: string;
    name: string;
    description: string | null;
    price: bigint;
    totalSupply: number;
    claimedCount: number;
    status: 'ACTIVE' | 'INACTIVE';
    createdAt: Date;
    updatedAt: Date;
  }): TicketTypeResponse {
    return {
      ...ticketType,
      price: ticketType.price.toString(),
      createdAt: ticketType.createdAt.toISOString(),
      updatedAt: ticketType.updatedAt.toISOString(),
    };
  }
}
