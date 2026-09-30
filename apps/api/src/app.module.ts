import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';

import { auth } from './auth/auth.js';
import { CheckInsModule } from './check-ins/check-ins.module.js';
import { EventsModule } from './events/events.module.js';
import { HealthModule } from './health/health.module.js';
import { PassesModule } from './passes/passes.module.js';
import { TicketTypesModule } from './ticket-types/ticket-types.module.js';
import { WalletsModule } from './wallets/wallets.module.js';

@Module({
  imports: [
    AuthModule.forRoot({
      auth,
    }),
    HealthModule,
    CheckInsModule,
    EventsModule,
    TicketTypesModule,
    PassesModule,
    WalletsModule,
  ],
})
export class AppModule {}
