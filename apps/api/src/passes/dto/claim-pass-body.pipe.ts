import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { claimPassInputSchema, type ClaimPassInput } from '@chainpass/schemas';

export class ClaimPassDto implements ClaimPassInput {
  @ApiPropertyOptional({
    minLength: 43,
    maxLength: 43,
    description:
      'Required for INVITE_ONLY events; bound to the requested ticket type',
  })
  invitationToken?: string;
}

@Injectable()
export class ClaimPassBodyValidationPipe implements PipeTransform<
  unknown,
  ClaimPassInput
> {
  transform(value: unknown): ClaimPassInput {
    const result = claimPassInputSchema.safeParse(value ?? {});
    if (result.success) return result.data;

    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Claim request may only contain a valid invitationToken',
    });
  }
}
