import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import {
  checkInInputSchema,
  type CheckInInput,
  type VerifyPassResponse,
} from '@chainpass/schemas';

export class CheckInInputDto implements CheckInInput {
  @ApiProperty({ enum: ['MANUAL', 'QR'], default: 'MANUAL' })
  method!: 'MANUAL' | 'QR';
}

@Injectable()
export class CheckInInputValidationPipe implements PipeTransform<
  unknown,
  CheckInInput
> {
  transform(value: unknown): CheckInInput {
    const result = checkInInputSchema.safeParse(value);

    if (result.success) return result.data;

    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: result.error.issues.map((issue) => ({
        code: issue.code,
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
}

class VerifiedByDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ format: 'email' })
  email!: string;
}

class CheckInSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ['MANUAL', 'QR'] })
  method!: 'MANUAL' | 'QR';

  @ApiProperty({ format: 'date-time' })
  verifiedAt!: string;

  @ApiProperty({ type: VerifiedByDto })
  verifiedBy!: VerifiedByDto;
}

class VerifyPassDto {
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

  @ApiProperty({ type: Number, nullable: true })
  chainId!: number | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

class VerifyEventDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ type: String, nullable: true })
  location!: string | null;
}

class VerifyTicketTypeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;
}

class VerifyHolderDto extends VerifiedByDto {}

export class VerifyPassResponseDto implements VerifyPassResponse {
  @ApiProperty({
    enum: ['VALID', 'ALREADY_CHECKED_IN', 'REVOKED', 'INVALID'],
  })
  verificationStatus!: 'VALID' | 'ALREADY_CHECKED_IN' | 'REVOKED' | 'INVALID';

  @ApiProperty({
    enum: ['VERIFIED', 'NOT_MINTED', 'MISMATCH', 'UNAVAILABLE'],
  })
  onChainStatus!: 'VERIFIED' | 'NOT_MINTED' | 'MISMATCH' | 'UNAVAILABLE';

  @ApiProperty()
  canCheckIn!: boolean;

  @ApiProperty({ type: VerifyPassDto })
  pass!: VerifyPassDto;

  @ApiProperty({ type: VerifyEventDto })
  event!: VerifyEventDto;

  @ApiProperty({ type: VerifyTicketTypeDto })
  ticketType!: VerifyTicketTypeDto;

  @ApiProperty({ type: VerifyHolderDto })
  holder!: VerifyHolderDto;

  @ApiProperty({ type: CheckInSummaryDto, nullable: true })
  checkIn!: CheckInSummaryDto | null;
}
