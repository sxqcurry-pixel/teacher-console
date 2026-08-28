import { Global, Module, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { EventEmitter } from 'events';
import { Inject, OnModuleInit } from '@nestjs/common';
import { redisConfig } from '../../config/redis.config';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * Pub/sub 接口，真实 ioredis 和内存 fallback 都实现它。
 * 代码里不要直接 import ioredis — 依赖注入这个接口即可。
 */
export interface PubSubClient {
  publish(channel: string, message: string): Promise<number>;
  subscribe(channel: string, listener: (channel: string, message: string) => void): Promise<void>;
  psubscribe?(pattern: string, listener?: (pattern: string, channel: string, message: string) => void): Promise<void>;
  duplicate?(): PubSubClient;
  quit?(): Promise<void>;
  ping?(): Promise<string>;
}

/**
 * 进程内 fallback — 没配置 Redis 时自动启用。
 * 单进程场景（Railway 单实例部署）完全够用。
 */
class MemoryPubSub extends EventEmitter implements PubSubClient {
  async publish(channel: string, message: string): Promise<number> {
    this.emit(channel, channel, message);
    // pattern match
    for (const pattern of (this as any)._patterns ?? []) {
      const re = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      if (re.test(channel)) this.emit(`__pattern:${pattern}`, pattern, channel, message);
    }
    return 1;
  }

  async subscribe(channel: string, listener: (ch: string, msg: string) => void): Promise<void> {
    this.on(channel, listener);
  }

  async psubscribe(pattern: string, listener?: (pattern: string, channel: string, message: string) => void): Promise<void> {
    (this as any)._patterns = (this as any)._patterns ?? [];
    (this as any)._patterns.push(pattern);
    if (listener) this.on(`__pattern:${pattern}`, listener);
  }

  duplicate(): PubSubClient {
    return new MemoryPubSub();
  }

  async quit(): Promise<void> {
    this.removeAllListeners();
  }
}

/**
 * 把 ioredis 包成 PubSubClient（它本身就兼容，只是 TypeScript 不认）。
 */
function wrapRedis(raw: any): PubSubClient {
  return {
    publish: (ch, msg) => raw.publish(ch, msg),
    subscribe: (ch, fn) => raw.subscribe(ch, fn),
    psubscribe: (p, fn) => raw.psubscribe(p, fn),
    duplicate: () => wrapRedis(raw.duplicate()),
    quit: () => raw.quit(),
    ping: () => raw.ping(),
  };
}

/**
 * Global Redis module — 有 host 就连真 Redis，没有就走内存 pub/sub。
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (cfg: ConfigType<typeof redisConfig>): PubSubClient => {
        const host = cfg.host;
        const port = cfg.port;
        const isMissing = !host || host === 'localhost' || port === 0;
        if (isMissing) {
          Logger.warn('Redis 未配置，使用内存 pub/sub（单进程够用）', RedisModule.name);
          return new MemoryPubSub();
        }
        // 延迟 require，避免 dev 没装 ioredis 时模块加载崩
        const RedisCtor = require('ioredis').default;
        const raw = new RedisCtor({
          host,
          port,
          password: cfg.password || undefined,
          db: cfg.db,
          lazyConnect: true,
          maxRetriesPerRequest: null,
        });
        return wrapRedis(raw);
      },
      inject: [redisConfig.KEY],
    },
    RedisModule,
  ],
  exports: [REDIS_CLIENT, RedisModule],
})
export class RedisModule implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: PubSubClient) {}

  async onModuleInit() {
    // MemoryPubSub 没有 connect()，跳过
    if (this.client.ping) {
      try {
        await this.client.ping();
        Logger.log('Redis connected', RedisModule.name);
      } catch (e) {
        Logger.warn(`Redis ping failed: ${(e as Error).message}. Running in-memory fallback.`, RedisModule.name);
      }
    }
  }

  async onModuleDestroy() {
    try {
      await this.client.quit?.();
    } catch {
      /* noop */
    }
  }
}
