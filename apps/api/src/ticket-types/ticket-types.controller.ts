import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type {
  CreateTicketTypeInput,
  TicketTypeResponse,
} from '@chainpass/schemas';

import { auth } from '../auth/auth.js';
import {
  CreateTicketTypeDto,
  CreateTicketTypeValidationPipe,
} from './dto/create-ticket-type.dto.js';
import { TicketTypeResponseDto } from './dto/ticket-type-response.dto.js';
import { TicketTypesService } from './ticket-types.service.js';

@ApiTags('ticket-types')
@ApiCookieAuth('session')
@Controller('events/:eventId/ticket-types')
export class TicketTypesController {
  constructor(private readonly ticketTypesService: TicketTypesService) {}

  @Post()
  @UserHasPermission({ permission: { event: ['update'] } })
  @ApiOperation({
    operationId: 'createTicketType',
    summary: 'Create a ticket type for an event',
  })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiBody({ type: CreateTicketTypeDto })
  @ApiCreatedResponse({ type: TicketTypeResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid ticket type input' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'Event update permission and organizer ownership required',
  })
  @ApiNotFoundResponse({ description: 'Event not found' })
  create(
    @Param('eventId') eventId: string,
    @Body(CreateTicketTypeValidationPipe) input: CreateTicketTypeInput,
    @Session() session: UserSession<typeof auth>,
  ): Promise<TicketTypeResponse> {
    return this.ticketTypesService.create(eventId, input, {
      id: session.user.id,
      role: session.user.role,
    });
  }

  @Get()
  @UserHasPermission({ permission: { event: ['update'] } })
  @ApiOperation({
    operationId: 'listTicketTypes',
    summary: 'List ticket types for an event',
  })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiOkResponse({ type: TicketTypeResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'Event update permission and organizer ownership required',
  })
  @ApiNotFoundResponse({ description: 'Event not found' })
  list(
    @Param('eventId') eventId: string,
    @Session() session: UserSession<typeof auth>,
  ): Promise<TicketTypeResponse[]> {
    return this.ticketTypesService.list(eventId, session.user);
  }
}
