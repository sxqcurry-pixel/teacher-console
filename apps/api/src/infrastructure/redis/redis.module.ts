import { Global, Module, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis, { RedisOptions } from 'ioredis';
import { ConfigType } from '@nestjs/config';
import { Inject, OnModuleInit } from '@nestjs/common';
import { redisConfig } from '../../config/redis.config';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * Global Redis module — single ioredis client shared for cache, pub/sub and locks.
 * For pub/sub use .duplicate() to isolate subscriber connections.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (cfg: ConfigType<typeof redisConfig>) => {
        const opts: RedisOptions = {
          host: cfg.host,
          port: cfg.port,
          password: cfg.password || undefined,
          db: cfg.db,
          lazyConnect: true,
          maxRetriesPerRequest: null, // required for bullmq
          enableReadyCheck: true,
          reconnectOnError: () => 2,
        };
        const client = new Redis(opts);
        client.on('error', (e) =>
          Logger.error(`Redis error: ${e.message}`, RedisModule.name),
        );
        return client;
      },
      inject: [redisConfig.KEY],
    },
    RedisModule,
  ],
  exports: [REDIS_CLIENT, RedisModule],
})
export class RedisModule implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onModuleInit() {
    try {
      await this.client.connect();
      Logger.log('Redis connected', RedisModule.name);
    } catch (e) {
      Logger.warn(`Redis connect failed: ${(e as Error).message}. Retrying in background…`, RedisModule.name);
    }
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
    } catch {
      /* noop */
    }
  }
}
