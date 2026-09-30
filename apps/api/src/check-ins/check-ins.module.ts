import { Module } from '@nestjs/common';

import { BlockchainModule } from '../blockchain/blockchain.module.js';
import { CheckInsController } from './check-ins.controller.js';
import { CheckInsService } from './check-ins.service.js';
import {
  QR_TOKEN_CLOCK,
  QrVerificationTokenService,
} from './qr-verification-token.service.js';

@Module({
  imports: [BlockchainModule],
  controllers: [CheckInsController],
  providers: [
    CheckInsService,
    QrVerificationTokenService,
    { provide: QR_TOKEN_CLOCK, useValue: () => Date.now() },
  ],
})
export class CheckInsModule {}
