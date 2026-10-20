import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable, map } from 'rxjs';
import { ApiResponse } from '../response';

@Injectable()
export class ApiResponseStatusInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((body: unknown) => {
        if (body instanceof ApiResponse) {
          context.switchToHttp().getResponse<Response>().status(body.status);
        }
        return body;
      }),
    );
  }
}
