import { Injectable } from '@nestjs/common';

import { prisma } from '../database/prisma.js';

export interface HealthStatus {
  status: 'ok';
  database: 'connected';
}

@Injectable()
export class HealthService {
  getHello(): string {
    return 'Hello World!';
  }

  async check(): Promise<HealthStatus> {
    await prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      database: 'connected',
    };
  }
}
