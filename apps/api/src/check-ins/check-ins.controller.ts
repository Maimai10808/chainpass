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
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type {
  CheckInResponse,
  PassVerificationTokenResponse,
  VerifyPassResponse,
  VerifyQrTokenResponse,
} from '@chainpass/schemas';

import { auth } from '../auth/auth.js';
import {
  CheckInInputDto,
  CheckInInputValidationPipe,
  VerifyPassResponseDto,
} from './dto/check-in-response.dto.js';
import {
  PassVerificationTokenResponseDto,
  VerifyQrTokenInputDto,
  VerifyQrTokenInputValidationPipe,
} from './dto/qr-verification.dto.js';
import { CheckInsService } from './check-ins.service.js';
import { QrVerificationTokenService } from './qr-verification-token.service.js';

@ApiTags('check-ins')
@ApiCookieAuth('session')
@Controller('passes')
export class CheckInsController {
  constructor(
    private readonly checkInsService: CheckInsService,
    private readonly qrTokens: QrVerificationTokenService,
  ) {}

  @Post(':passId/verification-token')
  @UserHasPermission({ permission: { pass: ['read'] } })
  @ApiOperation({
    operationId: 'createPassVerificationToken',
    summary: 'Create a short-lived verification token for my pass',
  })
  @ApiParam({ name: 'passId', description: 'Database Pass ID' })
  @ApiCreatedResponse({ type: PassVerificationTokenResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Pass ownership required' })
  @ApiNotFoundResponse({ description: 'Pass not found' })
  @ApiConflictResponse({ description: 'Pass is not active' })
  @ApiServiceUnavailableResponse({
    description: 'QR verification is not configured',
  })
  createVerificationToken(
    @Param('passId') passId: string,
    @Session() session: UserSession<typeof auth>,
  ): Promise<PassVerificationTokenResponse> {
    return this.qrTokens.create(passId, session.user.id);
  }

  @Post('verify-token')
  @HttpCode(HttpStatus.OK)
  @UserHasPermission({ permission: { pass: ['verify'] } })
  @ApiOperation({
    operationId: 'verifyPassToken',
    summary: 'Verify a pass from a signed QR token',
  })
  @ApiBody({ type: VerifyQrTokenInputDto })
  @ApiOkResponse({ type: VerifyPassResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid, expired, or malformed QR token',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'Pass verification permission and event ownership required',
  })
  @ApiNotFoundResponse({ description: 'Pass not found' })
  @ApiServiceUnavailableResponse({
    description: 'QR verification is not configured',
  })
  async verifyToken(
    @Body(VerifyQrTokenInputValidationPipe) input: VerifyQrTokenInputDto,
    @Session() session: UserSession<typeof auth>,
  ): Promise<VerifyQrTokenResponse> {
    const passId = await this.qrTokens.resolve(input.token);
    return this.checkInsService.verify(passId, {
      id: session.user.id,
      role: session.user.role,
    });
  }

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
