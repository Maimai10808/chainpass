import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
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
  ApiConflictResponse,
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
  CreateInvitationInput,
  ResolveInvitationInput,
} from '@chainpass/schemas';
import { auth } from '../auth/auth.js';
import { InvitationsService } from './invitations.service.js';
import {
  CreateInvitationDto,
  CreateInvitationResponseDto,
  CreateInvitationValidationPipe,
  InvitationPreviewDto,
  InvitationViewDto,
  ResolveInvitationDto,
  ResolveInvitationValidationPipe,
} from './dto/invitation.dto.js';

@ApiTags('invitations')
@ApiCookieAuth('session')
@ApiUnauthorizedResponse({
  description: 'Authentication required for management operations',
})
@ApiForbiddenResponse({
  description: 'Event update permission and organizer ownership required',
})
@ApiNotFoundResponse({ description: 'Event or invitation not found' })
@ApiBadRequestResponse({
  description: 'VALIDATION_ERROR, INVALID_TICKET_TYPE or INVALID_INVITATION',
})
@ApiConflictResponse({
  description:
    'INVITATION_EXPIRED, INVITATION_REVOKED, INVITATION_EXHAUSTED or INVITATION_UNAVAILABLE',
})
@Controller()
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post('events/:eventId/invitations')
  @Header('Cache-Control', 'private, no-store')
  @UserHasPermission({ permission: { event: ['update'] } })
  @ApiOperation({
    operationId: 'createInvitation',
    summary:
      'Create a shareable invitation for one active ticket type of a published invitation-only event',
  })
  @ApiParam({ name: 'eventId' })
  @ApiBody({ type: CreateInvitationDto })
  @ApiCreatedResponse({ type: CreateInvitationResponseDto })
  create(
    @Param('eventId') id: string,
    @Body(CreateInvitationValidationPipe) input: CreateInvitationInput,
    @Session() session: UserSession<typeof auth>,
  ) {
    return this.invitations.create(id, input, session.user);
  }

  @Get('events/:eventId/invitations')
  @Header('Cache-Control', 'private, no-store')
  @UserHasPermission({ permission: { event: ['update'] } })
  @ApiOperation({
    operationId: 'listInvitations',
    summary:
      'List invitation usage without returning credentials or token hashes',
  })
  @ApiParam({ name: 'eventId' })
  @ApiOkResponse({ type: InvitationViewDto, isArray: true })
  list(
    @Param('eventId') id: string,
    @Session() session: UserSession<typeof auth>,
  ) {
    return this.invitations.list(id, session.user);
  }

  @Post('invitations/:invitationId/revoke')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @UserHasPermission({ permission: { event: ['update'] } })
  @ApiOperation({
    operationId: 'revokeInvitation',
    summary: 'Stop future claims; existing passes are unaffected',
  })
  @ApiParam({ name: 'invitationId' })
  @ApiOkResponse({ type: InvitationViewDto })
  revoke(
    @Param('invitationId') id: string,
    @Session() session: UserSession<typeof auth>,
  ) {
    return this.invitations.revoke(id, session.user);
  }

  @Post('invitations/resolve')
  @HttpCode(200)
  @AllowAnonymous()
  @Header('Cache-Control', 'private, no-store')
  @Header('Referrer-Policy', 'no-referrer')
  @ApiOperation({
    operationId: 'resolveInvitation',
    summary:
      'Read-only anonymous bearer-link preview of one ticket type; does not consume quota',
    security: [],
  })
  @ApiBody({ type: ResolveInvitationDto })
  @ApiOkResponse({ type: InvitationPreviewDto })
  resolve(
    @Body(ResolveInvitationValidationPipe) input: ResolveInvitationInput,
  ) {
    return this.invitations.resolve(input.token);
  }
}
