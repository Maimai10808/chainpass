import { ApiProperty } from '@nestjs/swagger';
import type { ClaimPassResult, PassView } from '@chainpass/schemas';

type PassEvent = PassView['event'];
type PassTicketType = PassView['ticketType'];

class PassEventDto implements PassEvent {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  location!: string | null;

  @ApiProperty({ format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  endsAt!: string;
}

class PassTicketTypeDto implements PassTicketType {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({
    description: 'Price in integer minor currency units',
    example: '0',
  })
  price!: string;
}

export class PassViewDto implements PassView {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ['ACTIVE', 'CHECKED_IN', 'REVOKED'] })
  status!: 'ACTIVE' | 'CHECKED_IN' | 'REVOKED';

  @ApiProperty({ type: String, nullable: true })
  tokenId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  mintTxHash!: string | null;

  @ApiProperty({ type: String, nullable: true })
  contractAddress!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: PassEventDto })
  event!: PassEventDto;

  @ApiProperty({ type: PassTicketTypeDto })
  ticketType!: PassTicketTypeDto;
}

export class ClaimPassResultDto implements ClaimPassResult {
  @ApiProperty({ type: PassViewDto })
  pass!: PassViewDto;

  @ApiProperty({ description: 'Ticket inventory remaining after the claim' })
  remaining!: number;
}
