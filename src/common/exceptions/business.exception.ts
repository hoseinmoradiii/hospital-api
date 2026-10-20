import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorDetail } from '../response';

export class BusinessException extends HttpException {
  constructor(
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    readonly errors?: ErrorDetail[],
  ) {
    super(message, status);
  }
}
