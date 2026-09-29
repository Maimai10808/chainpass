import { Injectable } from '@nestjs/common';
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

    return {
      ...event,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }
}
