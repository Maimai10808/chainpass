import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateEventInput,
  EventResponse,
  ManagedEventSummary,
  PublicEventDetail,
  PublicEventSummary,
  PublicTicketType,
} from '@chainpass/schemas';

import { prisma } from '../database/prisma.js';

@Injectable()
export class EventsService {
  async listManaged(
    user: { id: string; role?: string | null },
    platform = false,
  ): Promise<ManagedEventSummary[]> {
    if (
      (platform && user.role !== 'admin') ||
      (!platform && user.role !== 'merchant' && user.role !== 'admin')
    ) {
      throw new ForbiddenException({
        code: 'EVENT_LIST_FORBIDDEN',
        message: platform
          ? 'Admin access required'
          : 'Merchant access required',
      });
    }
    const events = await prisma.event.findMany({
      where: platform ? {} : { organizerId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        organizer: { select: { id: true, name: true } },
        _count: { select: { ticketTypes: true } },
      },
    });
    return events.map(({ organizer, _count, ...event }) => ({
      ...this.toResponse(event),
      organizer,
      ticketTypeCount: _count.ticketTypes,
    }));
  }
  async create(
    input: CreateEventInput,
    organizerId: string,
  ): Promise<EventResponse> {
    const event = await prisma.event.create({
      data: {
        name: input.name,
        description: input.description,
        coverImageUrl: input.coverImageUrl,
        location: input.location,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        accessMode: input.accessMode ?? 'INVITE_ONLY',
        organizerId,
      },
    });

    return this.toResponse(event);
  }

  async getManagedById(
    eventId: string,
    user: { id: string; role?: string | null },
  ): Promise<EventResponse> {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
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
        message: 'Only the event organizer can manage this event',
      });
    }

    return this.toResponse(event);
  }

  async listPublished(): Promise<PublicEventSummary[]> {
    const events = await prisma.event.findMany({
      where: { status: 'PUBLISHED', accessMode: 'PUBLIC' },
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
    });

    return events.map((event) => this.toPublicSummary(event));
  }

  async getPublishedById(eventId: string): Promise<PublicEventDetail> {
    const event = await prisma.event.findFirst({
      where: { id: eventId, status: 'PUBLISHED', accessMode: 'PUBLIC' },
      include: {
        organizer: { select: { name: true } },
        ticketTypes: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!event) {
      throw new NotFoundException({
        code: 'EVENT_NOT_FOUND',
        message: 'Published event not found',
      });
    }

    return {
      ...this.toPublicSummary(event),
      organizer: event.organizer,
      ticketTypes: event.ticketTypes.map((ticketType) =>
        this.toPublicTicketType(ticketType),
      ),
    };
  }

  async publish(
    eventId: string,
    user: { id: string; role?: string | null },
  ): Promise<EventResponse> {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        ticketTypes: {
          where: { status: 'ACTIVE' },
          select: { id: true },
          take: 1,
        },
      },
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
        message: 'Only the event organizer can publish this event',
      });
    }

    if (event.status === 'PUBLISHED') {
      return this.toResponse(event);
    }

    if (event.ticketTypes.length === 0) {
      throw new BadRequestException({
        code: 'EVENT_HAS_NO_ACTIVE_TICKET_TYPES',
        message: 'Add at least one active ticket type before publishing',
      });
    }

    if (event.endsAt <= event.startsAt) {
      throw new BadRequestException({
        code: 'EVENT_TIME_RANGE_INVALID',
        message: 'Event end time must be later than its start time',
      });
    }

    const published = await prisma.event.update({
      where: { id: eventId },
      data: { status: 'PUBLISHED' },
    });

    return this.toResponse(published);
  }

  private toResponse(event: {
    id: string;
    name: string;
    description: string | null;
    coverImageUrl: string | null;
    location: string | null;
    startsAt: Date;
    endsAt: Date;
    status: 'DRAFT' | 'PUBLISHED';
    accessMode: 'PUBLIC' | 'INVITE_ONLY';
    organizerId: string;
    createdAt: Date;
    updatedAt: Date;
  }): EventResponse {
    return {
      ...event,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }

  private toPublicSummary(event: {
    id: string;
    name: string;
    description: string | null;
    coverImageUrl: string | null;
    location: string | null;
    startsAt: Date;
    endsAt: Date;
    status: 'DRAFT' | 'PUBLISHED';
  }): PublicEventSummary {
    return {
      id: event.id,
      name: event.name,
      description: event.description,
      coverImageUrl: event.coverImageUrl,
      location: event.location,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      status: 'PUBLISHED',
    };
  }

  private toPublicTicketType(ticketType: {
    id: string;
    name: string;
    description: string | null;
    price: bigint;
    totalSupply: number;
    claimedCount: number;
    status: 'ACTIVE' | 'INACTIVE';
  }): PublicTicketType {
    return {
      id: ticketType.id,
      name: ticketType.name,
      description: ticketType.description,
      price: ticketType.price.toString(),
      totalSupply: ticketType.totalSupply,
      claimedCount: ticketType.claimedCount,
      remaining: ticketType.totalSupply - ticketType.claimedCount,
      status: 'ACTIVE',
    };
  }
}
