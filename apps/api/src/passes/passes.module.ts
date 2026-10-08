import { Module } from '@nestjs/common';

import { BlockchainModule } from '../blockchain/blockchain.module.js';
import { InvitationsModule } from '../invitations/invitations.module.js';
import { PassClaimsController } from './pass-claims.controller.js';
import { PassesController } from './passes.controller.js';
import { PassesService } from './passes.service.js';

@Module({
  imports: [BlockchainModule, InvitationsModule],
  controllers: [PassClaimsController, PassesController],
  providers: [PassesService],
})
export class PassesModule {}
