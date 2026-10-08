import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import {
  createInvitationInputSchema,
  resolveInvitationInputSchema,
  type CreateInvitationInput,
  type ResolveInvitationInput,
  type InvitationView,
  type CreateInvitationResponse,
  type InvitationPreview,
} from '@chainpass/schemas';
import {
  PublicEventSummaryDto,
  PublicTicketTypeDto,
} from '../../events/dto/public-event-response.dto.js';

export class CreateInvitationDto implements CreateInvitationInput {
  @ApiProperty() ticketTypeId!: string;
  @ApiProperty({
    minimum: 1,
    maximum: 2147483647,
    description: 'Maximum successful claims, not reserved inventory',
  })
  maxUses!: number;
  @ApiProperty({ format: 'date-time', description: 'Future expiry timestamp' })
  expiresAt!: string;
}
export class ResolveInvitationDto implements ResolveInvitationInput {
  @ApiProperty({
    minLength: 43,
    maxLength: 43,
    description:
      'Opaque bearer invitation credential, never a QR verification token',
  })
  token!: string;
}
export class InvitationViewDto implements InvitationView {
  @ApiProperty() id!: string;
  @ApiProperty() ticketTypeId!: string;
  @ApiProperty() ticketTypeName!: string;
  @ApiProperty({ minimum: 1 }) maxUses!: number;
  @ApiProperty({ minimum: 0 }) usedCount!: number;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
  @ApiProperty({ type: String, nullable: true, format: 'date-time' })
  revokedAt!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
export class CreateInvitationResponseDto implements CreateInvitationResponse {
  @ApiProperty({ type: InvitationViewDto }) invitation!: InvitationViewDto;
  @ApiProperty({
    description:
      'Returned only once on creation; do not log or persist in analytics',
  })
  token!: string;
}
class OrganizerDto {
  @ApiProperty() name!: string;
}
class InvitedEventDto extends PublicEventSummaryDto {
  @ApiProperty({ type: OrganizerDto }) organizer!: OrganizerDto;
}
export class InvitationPreviewDto implements InvitationPreview {
  @ApiProperty({ type: InvitedEventDto }) event!: InvitedEventDto;
  @ApiProperty({ type: PublicTicketTypeDto }) ticketType!: PublicTicketTypeDto;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
  @ApiProperty({ minimum: 0 }) remainingUses!: number;
}
@Injectable()
export class CreateInvitationValidationPipe implements PipeTransform<
  unknown,
  CreateInvitationInput
> {
  transform(value: unknown): CreateInvitationInput {
    const parsed = createInvitationInputSchema.safeParse(value);
    if (parsed.success) return parsed.data;
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Provide a ticket type, positive claim limit and valid expiry',
    });
  }
}
@Injectable()
export class ResolveInvitationValidationPipe implements PipeTransform<
  unknown,
  ResolveInvitationInput
> {
  transform(value: unknown): ResolveInvitationInput {
    const parsed = resolveInvitationInputSchema.safeParse(value);
    if (parsed.success) return parsed.data;
    throw new BadRequestException({
      code: 'INVALID_INVITATION',
      message: 'Invalid invitation. Ask the organizer for a new link.',
    });
  }
}
