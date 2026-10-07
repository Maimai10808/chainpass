import { ApiProperty } from '@nestjs/swagger';
import type { ManagedEventSummary } from '@chainpass/schemas';
import { EventResponseDto } from './event-response.dto.js';

class EventOrganizerDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

export class ManagedEventSummaryDto
  extends EventResponseDto
  implements ManagedEventSummary
{
  @ApiProperty({ type: EventOrganizerDto })
  organizer!: EventOrganizerDto;

  @ApiProperty({ minimum: 0 })
  ticketTypeCount!: number;
}
