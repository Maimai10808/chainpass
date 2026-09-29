import { Controller, Get } from '@nestjs/common';
import {
  Session,
  UserHasPermission,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { PassView } from '@chainpass/schemas';

import { auth } from '../auth/auth.js';
import { PassViewDto } from './dto/pass-response.dto.js';
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
}
