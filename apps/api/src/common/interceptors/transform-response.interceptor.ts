import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { ApiResponse } from '@spark/shared';

/**
 * Wrap every controller return value into the standard ApiResponse envelope.
 * Skips wrapping if controller already returned an object with `code` + `data` keys,
 * so controllers can still opt-in manually.
 */
@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    _ctx: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((value: unknown) => {
        // Allow controllers to return raw stream / Buffer for downloads
        const res = _ctx.switchToHttp().getResponse();
        const contentType = res?.getHeader?.('content-type');
        if (contentType && typeof contentType === 'string' && contentType !== 'application/json') {
          return value as unknown as ApiResponse<T>;
        }

        if (
          value &&
          typeof value === 'object' &&
          'code' in value &&
          'data' in value &&
          'timestamp' in value
        ) {
          return value as unknown as ApiResponse<T>;
        }

        return {
          code: 0,
          message: 'ok',
          data: value as T,
          timestamp: new Date().toISOString(),
        } satisfies ApiResponse<T>;
      }),
    );
  }
}
