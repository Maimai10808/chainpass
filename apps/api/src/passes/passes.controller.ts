import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  Session,
  UserHasPermission,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { MintPassResult, PassView } from '@chainpass/schemas';

import { auth } from '../auth/auth.js';
import { MintPassResultDto, PassViewDto } from './dto/pass-response.dto.js';
import { PassesService } from './passes.service.js';

@ApiTags('passes')
@ApiCookieAuth('session')
@Controller('passes')
export class PassesController {
  constructor(private readonly passesService: PassesService) {}

  @Get('me')
  @UserHasPermission({ permission: { pass: ['read'] } })
  @ApiOperation({ operationId: 'getMyPasses', summary: 'List my passes' })
  @ApiOkResponse({ type: PassViewDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  getMine(@Session() session: UserSession<typeof auth>): Promise<PassView[]> {
    return this.passesService.getMine(session.user.id);
  }

  @Post(':passId/mint')
  @HttpCode(200)
  @UserHasPermission({ permission: { pass: ['mint'] } })
  @ApiOperation({ operationId: 'mintPass', summary: 'Mint my pass on-chain' })
  @ApiParam({ name: 'passId', description: 'Database Pass ID' })
  @ApiOkResponse({ type: MintPassResultDto })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Pass ownership required' })
  @ApiNotFoundResponse({ description: 'Pass not found' })
  @ApiConflictResponse({
    description: 'Pass or wallet state does not permit minting',
  })
  @ApiServiceUnavailableResponse({
    description: 'Blockchain configuration or transaction unavailable',
  })
  mint(
    @Param('passId') passId: string,
    @Session() session: UserSession<typeof auth>,
  ): Promise<MintPassResult> {
    return this.passesService.mint(passId, session.user.id);
  }
}
