import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  createTicketTypeInputSchema,
  type CreateTicketTypeInput,
} from '@chainpass/schemas';

export class CreateTicketTypeDto implements CreateTicketTypeInput {
  @ApiProperty({ example: 'General Pass', maxLength: 200 })
  name!: string;

  @ApiPropertyOptional({ example: 'General admission', maxLength: 2000 })
  description?: string;

  @ApiProperty({ example: 100, minimum: 1, maximum: 2_147_483_647 })
  totalSupply!: number;

  @ApiProperty({
    description:
      'Non-negative integer in the smallest currency unit; 0 is free',
    example: 0,
    minimum: 0,
    maximum: Number.MAX_SAFE_INTEGER,
  })
  price!: number;
}

@Injectable()
export class CreateTicketTypeValidationPipe implements PipeTransform<
  unknown,
  CreateTicketTypeInput
> {
  transform(value: unknown): CreateTicketTypeInput {
    const result = createTicketTypeInputSchema.safeParse(value);

    if (result.success) {
      return result.data;
    }

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
