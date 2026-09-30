import { Module } from '@nestjs/common';

import { BlockchainModule } from '../blockchain/blockchain.module.js';
import { CheckInsController } from './check-ins.controller.js';
import { CheckInsService } from './check-ins.service.js';

@Module({
  imports: [BlockchainModule],
  controllers: [CheckInsController],
  providers: [CheckInsService],
})
export class CheckInsModule {}
