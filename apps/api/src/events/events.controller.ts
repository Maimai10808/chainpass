import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  AllowAnonymous,
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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type {
  CreateEventInput,
  EventResponse,
  ManagedEventSummary,
  PublicEventDetail,
  PublicEventSummary,
} from '@chainpass/schemas';

import { auth } from '../auth/auth.js';
import {
  CreateEventDto,
  CreateEventValidationPipe,
} from './dto/create-event.dto.js';
import { EventResponseDto } from './dto/event-response.dto.js';
import { ManagedEventSummaryDto } from './dto/managed-event-summary.dto.js';
import {
  PublicEventDetailDto,
  PublicEventSummaryDto,
} from './dto/public-event-response.dto.js';
import { EventsService } from './events.service.js';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @ApiCookieAuth('session')
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

  @Post(':eventId/publish')
  @ApiCookieAuth('session')
  @HttpCode(HttpStatus.OK)
  @UserHasPermission({ permission: { event: ['publish'] } })
  @ApiOperation({ operationId: 'publishEvent', summary: 'Publish an event' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiOkResponse({ type: EventResponseDto })
  @ApiBadRequestResponse({
    description: 'The event does not satisfy the publishing rules',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'Event publish permission and organizer ownership required',
  })
  @ApiNotFoundResponse({ description: 'Event not found' })
  publish(
    @Param('eventId') eventId: string,
    @Session() session: UserSession<typeof auth>,
  ): Promise<EventResponse> {
    return this.eventsService.publish(eventId, {
      id: session.user.id,
      role: session.user.role,
    });
  }

  @Get()
  @AllowAnonymous()
  @ApiOperation({
    operationId: 'listPublishedEvents',
    summary: 'List published events',
  })
  @ApiOkResponse({ type: PublicEventSummaryDto, isArray: true })
  listPublished(): Promise<PublicEventSummary[]> {
    return this.eventsService.listPublished();
  }

  @Get('mine')
  @ApiCookieAuth('session')
  @UserHasPermission({ permission: { event: ['update'] } })
  @ApiOperation({
    operationId: 'listMyEvents',
    summary: 'List own draft and published events',
  })
  @ApiOkResponse({ type: ManagedEventSummaryDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Merchant or admin access required' })
  listMine(
    @Session() session: UserSession<typeof auth>,
  ): Promise<ManagedEventSummary[]> {
    return this.eventsService.listManaged(session.user);
  }

  @Get('admin')
  @ApiCookieAuth('session')
  @UserHasPermission({ permission: { event: ['read'] } })
  @ApiOperation({
    operationId: 'listAdminEvents',
    summary: 'List all platform events (admin only)',
  })
  @ApiOkResponse({ type: ManagedEventSummaryDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description:
      'Explicit admin role required; event read alone is insufficient',
  })
  listAdmin(
    @Session() session: UserSession<typeof auth>,
  ): Promise<ManagedEventSummary[]> {
    return this.eventsService.listManaged(session.user, true);
  }

  @Get(':eventId/manage')
  @ApiCookieAuth('session')
  @UserHasPermission({ permission: { event: ['update'] } })
  @ApiOperation({
    operationId: 'getManagedEvent',
    summary: 'Get an event for merchant management',
  })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiOkResponse({ type: EventResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'Event update permission and organizer ownership required',
  })
  @ApiNotFoundResponse({ description: 'Event not found' })
  getManagedById(
    @Param('eventId') eventId: string,
    @Session() session: UserSession<typeof auth>,
  ): Promise<EventResponse> {
    return this.eventsService.getManagedById(eventId, {
      id: session.user.id,
      role: session.user.role,
    });
  }

  @Get(':eventId')
  @AllowAnonymous()
  @ApiOperation({
    operationId: 'getPublishedEvent',
    summary: 'Get a published event by ID',
  })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiOkResponse({ type: PublicEventDetailDto })
  @ApiNotFoundResponse({ description: 'Published event not found' })
  getPublishedById(
    @Param('eventId') eventId: string,
  ): Promise<PublicEventDetail> {
    return this.eventsService.getPublishedById(eventId);
  }
}
