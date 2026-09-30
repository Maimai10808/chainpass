import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import {
  createWalletChallengeInputSchema,
  verifyWalletInputSchema,
  type CreateWalletChallengeInput,
  type VerifyWalletInput,
  type WalletChallengeResponse,
  type WalletView,
} from '@chainpass/schemas';

export class CreateWalletChallengeDto implements CreateWalletChallengeInput {
  @ApiProperty({ example: '0x1234567890123456789012345678901234567890' })
  address!: string;

  @ApiProperty({ example: 84532 })
  chainId!: number;
}

export class VerifyWalletDto implements VerifyWalletInput {
  @ApiProperty()
  challengeId!: string;

  @ApiProperty({ example: '0x1234567890123456789012345678901234567890' })
  address!: string;

  @ApiProperty({ description: 'EIP-191 personal message signature' })
  signature!: string;
}

export class WalletChallengeResponseDto implements WalletChallengeResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  address!: string;

  @ApiProperty({ example: 84532 })
  chainId!: number;

  @ApiProperty()
  message!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;
}

export class WalletViewDto implements WalletView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  address!: string;

  @ApiProperty({ example: 84532 })
  chainId!: number;

  @ApiProperty({ format: 'date-time' })
  verifiedAt!: string;
}

@Injectable()
export class CreateWalletChallengeValidationPipe implements PipeTransform<
  unknown,
  CreateWalletChallengeInput
> {
  transform(value: unknown): CreateWalletChallengeInput {
    return parseBody(createWalletChallengeInputSchema, value);
  }
}

@Injectable()
export class VerifyWalletValidationPipe implements PipeTransform<
  unknown,
  VerifyWalletInput
> {
  transform(value: unknown): VerifyWalletInput {
    return parseBody(verifyWalletInputSchema, value);
  }
}

function parseBody<T>(
  schema: {
    safeParse: (value: unknown) => {
      success: boolean;
      data?: T;
      error?: {
        issues: Array<{ code: string; path: PropertyKey[]; message: string }>;
      };
    };
  },
  value: unknown,
): T {
  const result = schema.safeParse(value);

  if (result.success) return result.data as T;

  throw new BadRequestException({
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    details: result.error?.issues.map((issue) => ({
      code: issue.code,
      path: issue.path.join('.'),
      message: issue.message,
    })),
  });
}
