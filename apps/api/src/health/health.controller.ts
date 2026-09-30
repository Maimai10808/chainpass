import { Controller, Get } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { ApiOperation } from '@nestjs/swagger';

import { HealthService, type HealthStatus } from './health.service.js';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ operationId: 'AppController_getHello' })
  getHello(): string {
    return this.healthService.getHello();
  }

  @Get('health')
  @AllowAnonymous()
  @ApiOperation({
    operationId: 'getHealth',
    summary: 'Check API and database health',
  })
  getHealth(): Promise<HealthStatus> {
    return this.healthService.check();
  }
}
