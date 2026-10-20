import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { ErrorDetail } from '../response';

export class DtoValidationException extends BadRequestException {
  readonly errors: ErrorDetail[];

  constructor(validationErrors: ValidationError[]) {
    super('Validation failed');
    this.errors = DtoValidationException.flatten(validationErrors);
  }

  private static flatten(
    validationErrors: ValidationError[],
    parentPath = '',
  ): ErrorDetail[] {
    return validationErrors.flatMap((error) => {
      const field = parentPath
        ? `${parentPath}.${error.property}`
        : error.property;
      const own: ErrorDetail[] = error.constraints
        ? [{ field, messages: Object.values(error.constraints) }]
        : [];
      return [
        ...own,
        ...DtoValidationException.flatten(error.children ?? [], field),
      ];
    });
  }
}
