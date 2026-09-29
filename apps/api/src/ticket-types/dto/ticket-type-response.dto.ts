import { ApiProperty } from '@nestjs/swagger';
import type { TicketTypeResponse } from '@chainpass/schemas';

export class TicketTypeResponseDto implements TicketTypeResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  eventId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({
    description:
      'Integer amount in the smallest currency unit, serialized as a decimal string',
    example: '0',
    pattern: '^\\d+$',
  })
  price!: string;

  @ApiProperty({ example: 100, minimum: 1 })
  totalSupply!: number;

  @ApiProperty({ example: 0, minimum: 0 })
  claimedCount!: number;

  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'] })
  status!: 'ACTIVE' | 'INACTIVE';

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
