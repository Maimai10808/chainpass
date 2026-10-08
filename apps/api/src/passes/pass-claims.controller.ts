import { Body, Controller, Param, Post } from '@nestjs/common';
import {
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
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { ClaimPassInput, ClaimPassResult } from '@chainpass/schemas';

import { auth } from '../auth/auth.js';
import {
  ClaimPassDto,
  ClaimPassBodyValidationPipe,
} from './dto/claim-pass-body.pipe.js';
import { ClaimPassResultDto } from './dto/pass-response.dto.js';
import { PassesService } from './passes.service.js';

@ApiTags('passes')
@ApiCookieAuth('session')
@Controller('ticket-types')
export class PassClaimsController {
  constructor(private readonly passesService: PassesService) {}

  @Post(':ticketTypeId/claim')
  @UserHasPermission({ permission: { pass: ['claim'] } })
  @ApiOperation({ operationId: 'claimPass', summary: 'Claim a pass' })
  @ApiParam({ name: 'ticketTypeId', description: 'Ticket type ID' })
  @ApiBody({ type: ClaimPassDto, required: false })
  @ApiCreatedResponse({ type: ClaimPassResultDto })
  @ApiBadRequestResponse({ description: 'Invalid claim request' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'Pass claim permission required or INVITATION_REQUIRED',
  })
  @ApiNotFoundResponse({ description: 'Ticket type or event not found' })
  @ApiConflictResponse({
    description:
      'Event unpublished, type inactive/sold out, duplicate pass, or invitation expired/revoked/exhausted/unavailable',
  })
  claim(
    @Param('ticketTypeId') ticketTypeId: string,
    @Body(ClaimPassBodyValidationPipe) input: ClaimPassInput,
    @Session() session: UserSession<typeof auth>,
  ): Promise<ClaimPassResult> {
    return this.passesService.claim(
      ticketTypeId,
      session.user.id,
      input.invitationToken,
    );
  }
}
