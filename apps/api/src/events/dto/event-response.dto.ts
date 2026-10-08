import { ApiProperty } from '@nestjs/swagger';
import type { EventResponse } from '@chainpass/schemas';

export class EventResponseDto implements EventResponse {
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

  @ApiProperty({ enum: ['DRAFT', 'PUBLISHED'] })
  status!: 'DRAFT' | 'PUBLISHED';

  @ApiProperty({ enum: ['PUBLIC', 'INVITE_ONLY'] })
  accessMode!: 'PUBLIC' | 'INVITE_ONLY';

  @ApiProperty()
  organizerId!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
