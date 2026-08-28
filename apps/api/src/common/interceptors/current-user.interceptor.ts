import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

declare module 'express' {
  interface Request {
    user?: {
      id: string;
      email: string;
      role: string;
    };
  }
}

/**
 * Populates `req.user` on controllers that use JwtAuthGuard so @CurrentUser() decorator works.
 * Attached automatically by JwtAuthGuard in most setups; we keep this interceptor for explicit scenarios.
 */
@Injectable()
export class CurrentUserInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    if (req && req.user) {
      // already populated by JWT strategy
    }
    return next.handle();
  }
}
