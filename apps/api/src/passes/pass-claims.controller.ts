import { Body, Controller, Param, Post } from '@nestjs/common';
import {
  Session,
  UserHasPermission,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import {
  ApiBadRequestResponse,
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
import type { ClaimPassResult } from '@chainpass/schemas';

import { auth } from '../auth/auth.js';
import { ClaimPassBodyValidationPipe } from './dto/claim-pass-body.pipe.js';
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
  @ApiCreatedResponse({ type: ClaimPassResultDto })
  @ApiBadRequestResponse({ description: 'Invalid claim request' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Pass claim permission required' })
  @ApiNotFoundResponse({ description: 'Ticket type or event not found' })
  @ApiConflictResponse({
    description:
      'Event is not published, ticket type is inactive or sold out, or the pass was already claimed',
  })
  claim(
    @Param('ticketTypeId') ticketTypeId: string,
    @Body(ClaimPassBodyValidationPipe) _body: void,
    @Session() session: UserSession<typeof auth>,
  ): Promise<ClaimPassResult> {
    return this.passesService.claim(ticketTypeId, session.user.id);
  }
}
