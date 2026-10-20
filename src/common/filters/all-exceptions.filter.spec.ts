import {
  ArgumentsHost,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { Error as MongooseError, mongo } from 'mongoose';
import { BusinessException, DtoValidationException } from '../exceptions';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();
  let status: jest.Mock;
  let json: jest.Mock;
  let host: ArgumentsHost;
  let logError: jest.SpyInstance;

  beforeEach(() => {
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    host = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', originalUrl: '/test' }),
        getResponse: () => ({ status }),
      }),
    } as unknown as ArgumentsHost;
    logError = jest
      .spyOn(filter['logger'], 'error')
      .mockImplementation(() => undefined);
  });

  const handle = (exception: unknown) => {
    filter.catch(exception, host);
    return { code: status.mock.calls[0][0], body: json.mock.calls[0][0] };
  };

  it('formats DTO validation errors with field paths', () => {
    const child = Object.assign(new ValidationError(), {
      property: 'city',
      constraints: { isString: 'city must be a string' },
      children: [],
    });
    const errors = [
      Object.assign(new ValidationError(), {
        property: 'email',
        constraints: { isEmail: 'Please Enter Correct Email' },
        children: [],
      }),
      Object.assign(new ValidationError(), {
        property: 'address',
        children: [child],
      }),
    ];

    const { code, body } = handle(new DtoValidationException(errors));

    expect(code).toBe(HttpStatus.BAD_REQUEST);
    expect(body).toMatchObject({
      status: 400,
      message: 'Validation failed',
      errors: [
        { field: 'email', messages: ['Please Enter Correct Email'] },
        { field: 'address.city', messages: ['city must be a string'] },
      ],
    });
  });

  it('handles business (logical) exceptions', () => {
    const { code, body } = handle(
      new BusinessException('Doctor is not available', HttpStatus.CONFLICT),
    );
    expect(code).toBe(409);
    expect(body).toMatchObject({
      status: 409,
      code: 'Conflict',
      message: 'Doctor is not available',
    });
  });

  it('handles built-in HTTP exceptions', () => {
    expect(handle(new NotFoundException('no user')).body).toMatchObject({
      status: 404,
      message: 'no user',
    });
  });

  it('keeps guard rejections as 403', () => {
    expect(handle(new ForbiddenException()).code).toBe(403);
  });

  it('maps mongoose ValidationError to 400', () => {
    const error = new MongooseError.ValidationError();
    error.addError(
      'email',
      new MongooseError.ValidatorError({
        path: 'email',
        message: 'email is required',
      }),
    );
    const { code, body } = handle(error);
    expect(code).toBe(400);
    expect(body.errors).toEqual([
      { field: 'email', messages: ['email is required'] },
    ]);
  });

  it('maps mongoose CastError to 400', () => {
    const { code, body } = handle(
      new MongooseError.CastError('ObjectId', 'abc', '_id'),
    );
    expect(code).toBe(400);
    expect(body.message).toBe("Invalid value for '_id'");
  });

  it('maps duplicate key errors to 409', () => {
    const error = new mongo.MongoServerError({
      message: 'E11000 duplicate key error',
      code: 11000,
      keyValue: { email: 'a@b.com' },
    });
    const { code, body } = handle(error);
    expect(code).toBe(409);
    expect(body.message).toBe('Duplicate value for email');
  });

  it('maps database connectivity errors to 503', () => {
    const { code } = handle(new mongo.MongoNetworkError('connection lost'));
    expect(code).toBe(503);
  });

  it('maps mongoose buffering timeouts (DB down) to 503', () => {
    const { code } = handle(
      new MongooseError(
        'Operation `users.findOne()` buffering timed out after 10000ms',
      ),
    );
    expect(code).toBe(503);
  });

  it('maps other database errors to 500 without leaking details', () => {
    const { code, body } = handle(
      new mongo.MongoServerError({ message: 'secret internals', code: 2 }),
    );
    expect(code).toBe(500);
    expect(body.message).toBe('Database error');
  });

  it('maps unknown errors to 500 and logs them', () => {
    const { code, body } = handle(new TypeError('x is undefined'));
    expect(code).toBe(500);
    expect(body).toMatchObject({
      status: 500,
      code: 'Internal Server Error',
      message: 'Internal server error',
    });
    expect(logError).toHaveBeenCalled();
  });
});
