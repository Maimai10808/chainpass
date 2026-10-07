import { ApiProperty } from '@nestjs/swagger';
import type {
  PublicEventDetail,
  PublicEventSummary,
  PublicTicketType,
} from '@chainpass/schemas';

export class PublicEventSummaryDto implements PublicEventSummary {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: String, format: 'uri', nullable: true })
  coverImageUrl!: string | null;

  @ApiProperty({ type: String, nullable: true })
  location!: string | null;

  @ApiProperty({ format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;

  @ApiProperty({ enum: ['PUBLISHED'] })
  status!: 'PUBLISHED';
}

export class PublicTicketTypeDto implements PublicTicketType {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({
    description: 'Price in integer minor currency units',
    example: '0',
  })
  price!: string;

  @ApiProperty()
  totalSupply!: number;

  @ApiProperty()
  claimedCount!: number;

  @ApiProperty({ description: 'Server-computed totalSupply - claimedCount' })
  remaining!: number;

  @ApiProperty({ enum: ['ACTIVE'] })
  status!: 'ACTIVE';
}

class PublicEventOrganizerDto {
  @ApiProperty()
  name!: string;
}

export class PublicEventDetailDto
  extends PublicEventSummaryDto
  implements PublicEventDetail
{
  @ApiProperty({ type: PublicEventOrganizerDto })
  organizer!: PublicEventOrganizerDto;

  @ApiProperty({ type: PublicTicketTypeDto, isArray: true })
  ticketTypes!: PublicTicketTypeDto[];
}
