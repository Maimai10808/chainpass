import { Test, type TestingModule } from '@nestjs/testing';

import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

describe('HealthController', () => {
  let healthController: HealthController;
  const health = {
    status: 'ok' as const,
    database: 'connected' as const,
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: {
            getHello: () => 'Hello World!',
            check: async () => health,
          },
        },
      ],
    }).compile();

    healthController = app.get<HealthController>(HealthController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(healthController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('reports API and database readiness', async () => {
      await expect(healthController.getHealth()).resolves.toEqual(health);
    });
  });
});
