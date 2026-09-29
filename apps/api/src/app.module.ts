import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { auth } from './auth/auth.js';
import { EventsModule } from './events/events.module.js';
import { TicketTypesModule } from './ticket-types/ticket-types.module.js';

@Module({
  imports: [
    AuthModule.forRoot({
      auth,
    }),
    EventsModule,
    TicketTypesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
