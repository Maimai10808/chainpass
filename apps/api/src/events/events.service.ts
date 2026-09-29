import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateEventInput, EventResponse } from '@chainpass/schemas';

import { prisma } from '../lib/prisma.js';

@Injectable()
export class EventsService {
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
        organizerId,
      },
    });

    return this.toResponse(event);
  }

  async getById(eventId: string): Promise<EventResponse> {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException({
        code: 'EVENT_NOT_FOUND',
        message: 'Event not found',
      });
    }

    return this.toResponse(event);
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
}
