import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import {
  verifyQrTokenInputSchema,
  type PassVerificationTokenResponse,
  type VerifyQrTokenInput,
} from '@chainpass/schemas';

export class PassVerificationTokenResponseDto implements PassVerificationTokenResponse {
  @ApiProperty({ description: 'Short-lived signed Pass credential' })
  token!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;
}

export class VerifyQrTokenInputDto implements VerifyQrTokenInput {
  @ApiProperty({ description: 'Signed credential decoded from the QR code' })
  token!: string;
}

@Injectable()
export class VerifyQrTokenInputValidationPipe implements PipeTransform<
  unknown,
  VerifyQrTokenInput
> {
  transform(value: unknown): VerifyQrTokenInput {
    const result = verifyQrTokenInputSchema.safeParse(value);
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
