import { Body, Controller, Post } from '@nestjs/common';
import {
  Session,
  UserHasPermission,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { CreateEventInput, EventResponse } from '@chainpass/schemas';

import { auth } from '../auth/auth.js';
import {
  CreateEventDto,
  CreateEventValidationPipe,
} from './dto/create-event.dto.js';
import { EventResponseDto } from './dto/event-response.dto.js';
import { EventsService } from './events.service.js';

@ApiTags('events')
@ApiCookieAuth('session')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @UserHasPermission({ permission: { event: ['create'] } })
  @ApiOperation({ operationId: 'createEvent', summary: 'Create an event' })
  @ApiBody({ type: CreateEventDto })
  @ApiCreatedResponse({ type: EventResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid event input',
    schema: {
      example: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: [
          {
            code: 'custom',
            path: 'endsAt',
            message: 'End time must be later than start time',
          },
        ],
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized',
      },
    },
  })
  @ApiForbiddenResponse({
    description: 'Event create permission required',
    schema: {
      example: {
        statusCode: 403,
        message: 'Insufficient permissions',
      },
    },
  })
  create(
    @Body(CreateEventValidationPipe) input: CreateEventInput,
    @Session() session: UserSession<typeof auth>,
  ): Promise<EventResponse> {
    return this.eventsService.create(input, session.user.id);
  }
}
