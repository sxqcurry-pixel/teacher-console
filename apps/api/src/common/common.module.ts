import { Global, Module } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUserInterceptor } from './interceptors/current-user.interceptor';
import { TransformResponseInterceptor } from './interceptors/transform-response.interceptor';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { DomainEventBus } from './domain-event/domain-event-bus.service';

/**
 * Global providers — available in every module via @Global().
 */
@Global()
@Module({
  providers: [
    JwtAuthGuard,
    CurrentUserInterceptor,
    TransformResponseInterceptor,
    AllExceptionsFilter,
    DomainEventBus,
  ],
  exports: [
    JwtAuthGuard,
    CurrentUserInterceptor,
    TransformResponseInterceptor,
    AllExceptionsFilter,
    DomainEventBus,
  ],
})
export class CommonModule {}
