import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigType } from '@nestjs/config';
import { jwtConfig } from '../config/jwt.config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUserInterceptor } from './interceptors/current-user.interceptor';
import { TransformResponseInterceptor } from './interceptors/transform-response.interceptor';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { DomainEventBus } from './domain-event/domain-event-bus.service';

/**
 * Global providers — available in every module via @Global().
 * JwtModule is registered here (global) so JwtAuthGuard can resolve JwtService.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      useFactory: (cfg: ConfigType<typeof jwtConfig>) => ({
        secret: cfg.secret,
        signOptions: { expiresIn: cfg.accessTtl },
      }),
      inject: [jwtConfig.KEY],
    }),
  ],
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
    JwtModule,
  ],
})
export class CommonModule {}
