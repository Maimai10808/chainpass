import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';

@Injectable()
export class ClaimPassBodyValidationPipe implements PipeTransform<unknown, void> {
  transform(value: unknown): void {
    if (
      value === undefined ||
      value === null ||
      (typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.keys(value).length === 0)
    ) {
      return;
    }

    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Claim Pass does not accept a request body',
    });
  }
}
