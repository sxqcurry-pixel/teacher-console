import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { EventHandler, TypedDomainEvent } from './types';
import { REDIS_CLIENT, PubSubClient } from '../../infrastructure/redis/redis.module';
import { cuidLike } from '@shared/utils';

/**
 * 进程内 + 跨实例 pub/sub 总线。
 *
 * - 本地 handler 通过 Map 同步 dispatch
 * - 每条事件同时 publish 到 `event:{name}` 和 `sync:{channel}`
 * - 没 Redis 时走 MemoryPubSub（单进程等价）
 */
@Injectable()
export class DomainEventBus implements OnModuleDestroy {
  private readonly logger = new Logger(DomainEventBus.name);
  private readonly handlers = new Map<string, Set<EventHandler>>();

  constructor(@Inject(REDIS_CLIENT) private readonly pubsub: PubSubClient) {}

  on<T = unknown>(eventName: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventName)) this.handlers.set(eventName, new Set());
    this.handlers.get(eventName)!.add(handler as EventHandler);
    // 跨实例订阅（真 Redis / 内存 fallback 都支持）
    this.pubsub
      .subscribe(`event:${eventName}`, (_channel, message) => {
        try {
          const event = JSON.parse(message) as TypedDomainEvent;
          this.dispatch(event.name, event, false);
        } catch (e) {
          this.logger.warn(`Failed to parse event @ ${eventName}: ${(e as Error).message}`);
        }
      })
      .catch((e) => this.logger.warn(`pubsub subscribe failed event:${eventName} — ${(e as Error).message}`));
    return () => this.handlers.get(eventName)?.delete(handler as EventHandler);
  }

  async publish<T>(event: Omit<TypedDomainEvent<T>, 'id' | 'occurredAt'>): Promise<void> {
    const full: TypedDomainEvent<T> = {
      id: cuidLike('evt_'),
      occurredAt: new Date().toISOString(),
      ...event,
    } as TypedDomainEvent<T>;
    this.dispatch(full.name, full, true);
    try {
      await this.pubsub.publish(`event:${full.name}`, JSON.stringify(full));
      if (full.channel) {
        await this.pubsub.publish(`sync:${full.channel}`, JSON.stringify(full));
      }
    } catch (e) {
      this.logger.warn(`pubsub publish failed: ${(e as Error).message}`);
    }
  }

  private dispatch<T>(name: string, event: TypedDomainEvent<T>, local: boolean): void {
    const set = this.handlers.get(name);
    if (!set && !this.handlers.has('*')) return;
    const run = (h: EventHandler) => {
      try {
        const r = h(event);
        if (r && typeof (r as Promise<unknown>).catch === 'function') {
          (r as Promise<unknown>).catch((e) =>
            this.logger.error(`Handler for ${name} crashed: ${(e as Error).stack ?? e}`),
          );
        }
      } catch (e) {
        this.logger.error(`Handler for ${name} threw: ${(e as Error).stack ?? e}`);
      }
    };
    set?.forEach(run);
    if (local) this.handlers.get('*')?.forEach(run);
  }

  async onModuleDestroy() {
    try {
      await this.pubsub.quit?.();
    } catch {
      /* noop */
    }
  }
}
