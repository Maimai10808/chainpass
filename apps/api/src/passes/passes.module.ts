import { Module } from '@nestjs/common';

import { PassClaimsController } from './pass-claims.controller.js';
import { PassesController } from './passes.controller.js';
import { PassesService } from './passes.service.js';

@Module({
  controllers: [PassClaimsController, PassesController],
  providers: [PassesService],
})
export class PassesModule {}
