import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { getReasonPhrase } from 'http-status-codes';
import { Error as MongooseError, mongo } from 'mongoose';
import { ApiResponse, ErrorDetail } from '../response';
import { BusinessException, DtoValidationException } from '../exceptions';

interface ResolvedError {
  status: number;
  message: string;
  errors?: ErrorDetail[];
}

const MONGO_DUPLICATE_KEY = 11000;

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { status, message, errors } = this.resolve(exception);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl} -> ${status}: ${this.describe(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response
      .status(status)
      .json(
        ApiResponse.error(status, this.reasonPhrase(status), message, errors),
      );
  }

  private resolve(exception: unknown): ResolvedError {
    if (exception instanceof DtoValidationException) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        errors: exception.errors,
      };
    }

    if (exception instanceof BusinessException) {
      return {
        status: exception.getStatus(),
        message: exception.message,
        errors: exception.errors,
      };
    }

    if (exception instanceof HttpException) {
      return this.resolveHttpException(exception);
    }

    if (
      exception instanceof MongooseError ||
      exception instanceof mongo.MongoError
    ) {
      return this.resolveOrmError(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }

  private resolveHttpException(exception: HttpException): ResolvedError {
    const status = exception.getStatus();
    const body = exception.getResponse();
    const rawMessage =
      typeof body === 'string' ? body : (body as { message?: unknown }).message;

    if (Array.isArray(rawMessage)) {
      return {
        status,
        message: 'Validation failed',
        errors: [{ messages: rawMessage.map(String) }],
      };
    }

    return {
      status,
      message: typeof rawMessage === 'string' ? rawMessage : exception.message,
    };
  }

  private resolveOrmError(
    exception: MongooseError | mongo.MongoError,
  ): ResolvedError {
    if (exception instanceof MongooseError.ValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        errors: Object.values(exception.errors).map((error) => ({
          field: error.path,
          messages: [error.message],
        })),
      };
    }

    if (exception instanceof MongooseError.CastError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: `Invalid value for '${exception.path}'`,
        errors: [
          {
            field: exception.path,
            messages: [`Expected a valid ${exception.kind}`],
          },
        ],
      };
    }

    if (exception instanceof MongooseError.StrictModeError) {
      return { status: HttpStatus.BAD_REQUEST, message: exception.message };
    }

    if (exception instanceof MongooseError.DocumentNotFoundError) {
      return { status: HttpStatus.NOT_FOUND, message: 'Resource not found' };
    }

    if (exception instanceof MongooseError.VersionError) {
      return {
        status: HttpStatus.CONFLICT,
        message: 'Resource was modified by another request, please retry',
      };
    }

    if (
      exception instanceof mongo.MongoServerError &&
      exception.code === MONGO_DUPLICATE_KEY
    ) {
      const fields = Object.keys(
        exception.keyValue ?? exception.keyPattern ?? {},
      );
      return {
        status: HttpStatus.CONFLICT,
        message: fields.length
          ? `Duplicate value for ${fields.join(', ')}`
          : 'Duplicate value',
        errors: fields.map((field) => ({
          field,
          messages: [`${field} already exists`],
        })),
      };
    }

    if (this.isConnectionError(exception)) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Database is unavailable, please try again later',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Database error',
    };
  }

  private isConnectionError(
    exception: MongooseError | mongo.MongoError,
  ): boolean {
    return (
      exception instanceof MongooseError.MongooseServerSelectionError ||
      exception instanceof mongo.MongoServerSelectionError ||
      exception instanceof mongo.MongoNetworkError ||
      exception instanceof mongo.MongoNotConnectedError ||
      /buffering timed out/i.test(exception.message)
    );
  }

  private reasonPhrase(status: number): string {
    try {
      return getReasonPhrase(status);
    } catch {
      return String(status);
    }
  }

  private describe(exception: unknown): string {
    return exception instanceof Error
      ? `${exception.name}: ${exception.message}`
      : String(exception);
  }
}
