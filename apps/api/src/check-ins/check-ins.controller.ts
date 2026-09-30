import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  Session,
  UserHasPermission,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import {
  ApiCookieAuth,
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { CheckInResponse, VerifyPassResponse } from '@chainpass/schemas';

import { auth } from '../auth/auth.js';
import {
  CheckInInputDto,
  CheckInInputValidationPipe,
  VerifyPassResponseDto,
} from './dto/check-in-response.dto.js';
import { CheckInsService } from './check-ins.service.js';

@ApiTags('check-ins')
@ApiCookieAuth('session')
@Controller('passes')
export class CheckInsController {
  constructor(private readonly checkInsService: CheckInsService) {}

  @Get(':passId/verify')
  @UserHasPermission({ permission: { pass: ['verify'] } })
  @ApiOperation({ operationId: 'verifyPass', summary: 'Verify a pass' })
  @ApiParam({ name: 'passId', description: 'Database Pass ID' })
  @ApiOkResponse({ type: VerifyPassResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'Pass verification permission and event ownership required',
  })
  @ApiNotFoundResponse({ description: 'Pass not found' })
  verify(
    @Param('passId') passId: string,
    @Session() session: UserSession<typeof auth>,
  ): Promise<VerifyPassResponse> {
    return this.checkInsService.verify(passId, {
      id: session.user.id,
      role: session.user.role,
    });
  }

  @Post(':passId/check-in')
  @UserHasPermission({ permission: { pass: ['check-in'] } })
  @ApiOperation({ operationId: 'checkInPass', summary: 'Check in a pass' })
  @ApiParam({ name: 'passId', description: 'Database Pass ID' })
  @ApiBody({ type: CheckInInputDto })
  @ApiCreatedResponse({ type: VerifyPassResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid check-in input' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'Pass check-in permission and event ownership required',
  })
  @ApiNotFoundResponse({ description: 'Pass not found' })
  @ApiConflictResponse({
    description: 'Pass is already checked in, revoked, or inconsistent',
  })
  checkIn(
    @Param('passId') passId: string,
    @Body(CheckInInputValidationPipe) input: CheckInInputDto,
    @Session() session: UserSession<typeof auth>,
  ): Promise<CheckInResponse> {
    return this.checkInsService.checkIn(passId, input, {
      id: session.user.id,
      role: session.user.role,
    });
  }
}
