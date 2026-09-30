import { Body, Controller, Get, Post, Res } from '@nestjs/common';
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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { WalletChallengeResponse, WalletView } from '@chainpass/schemas';
import type { Response } from 'express';

import { auth } from '../auth/auth.js';
import {
  CreateWalletChallengeDto,
  CreateWalletChallengeValidationPipe,
  VerifyWalletDto,
  VerifyWalletValidationPipe,
  WalletChallengeResponseDto,
  WalletViewDto,
} from './dto/wallet.dto.js';
import { WalletsService } from './wallets.service.js';

@ApiTags('wallets')
@ApiCookieAuth('session')
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Post('challenge')
  @UserHasPermission({ permission: { wallet: ['bind'] } })
  @ApiOperation({
    operationId: 'createWalletChallenge',
    summary: 'Create a wallet ownership challenge',
  })
  @ApiCreatedResponse({ type: WalletChallengeResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid wallet or chain' })
  @ApiConflictResponse({ description: 'Account already has a wallet' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  createChallenge(
    @Body(CreateWalletChallengeValidationPipe)
    input: CreateWalletChallengeDto,
    @Session() session: UserSession<typeof auth>,
  ): Promise<WalletChallengeResponse> {
    return this.walletsService.createChallenge(session.user.id, input);
  }

  @Post('verify')
  @UserHasPermission({ permission: { wallet: ['bind'] } })
  @ApiOperation({
    operationId: 'verifyWallet',
    summary: 'Verify a signature and bind the wallet',
  })
  @ApiCreatedResponse({ type: WalletViewDto })
  @ApiBadRequestResponse({ description: 'Invalid signature or challenge' })
  @ApiNotFoundResponse({ description: 'Challenge not found for this user' })
  @ApiConflictResponse({
    description: 'Challenge unavailable or wallet binding conflict',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  verify(
    @Body(VerifyWalletValidationPipe) input: VerifyWalletDto,
    @Session() session: UserSession<typeof auth>,
  ): Promise<WalletView> {
    return this.walletsService.verify(session.user.id, input);
  }

  @Get('me')
  @UserHasPermission({ permission: { wallet: ['read'] } })
  @ApiOperation({ operationId: 'getMyWallet', summary: 'Get my bound wallet' })
  @ApiOkResponse({ type: WalletViewDto, nullable: true })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getMine(
    @Session() session: UserSession<typeof auth>,
    @Res() response: Response,
  ): Promise<Response> {
    return response.json(await this.walletsService.getMine(session.user.id));
  }
}
