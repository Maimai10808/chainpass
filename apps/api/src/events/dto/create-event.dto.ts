import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  createEventInputSchema,
  type CreateEventInput,
} from '@chainpass/schemas';

export class CreateEventDto implements CreateEventInput {
  @ApiProperty({ example: 'ChainPass Hackathon 2026', maxLength: 200 })
  name!: string;

  @ApiPropertyOptional({
    enum: ['PUBLIC', 'INVITE_ONLY'],
    default: 'INVITE_ONLY',
    description: 'Invitation-only events are not publicly discoverable',
  })
  accessMode?: 'PUBLIC' | 'INVITE_ONLY';

  @ApiPropertyOptional({ example: 'Internal hackathon', maxLength: 5000 })
  description?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/chainpass.png',
    format: 'uri',
  })
  coverImageUrl?: string;

  @ApiPropertyOptional({ example: 'Beijing', maxLength: 500 })
  location?: string;

  @ApiProperty({ example: '2026-10-10T01:00:00.000Z', format: 'date-time' })
  startsAt!: string;

  @ApiProperty({ example: '2026-10-10T09:00:00.000Z', format: 'date-time' })
  endsAt!: string;
}

@Injectable()
export class CreateEventValidationPipe implements PipeTransform<
  unknown,
  CreateEventInput
> {
  transform(value: unknown): CreateEventInput {
    const result = createEventInputSchema.safeParse(value);

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
