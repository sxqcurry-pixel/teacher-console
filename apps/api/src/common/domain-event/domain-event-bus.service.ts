import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import type { EventHandler, TypedDomainEvent } from './types';
import { REDIS_CLIENT } from '../../infrastructure/redis/redis.module';
import { cuidLike } from '@shared/utils';

/**
 * Shared publish/subscribe service used by every write-side feature module.
 *
 * - in-process handlers are notified synchronously via emit().
 * - every event is also published to Redis channel `event:{name}` so multi-instance
 *   deployments + SyncGateway can fan it out to connected browsers.
 */
@Injectable()
export class DomainEventBus implements OnModuleDestroy {
  private readonly logger = new Logger(DomainEventBus.name);
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly subClient: Redis | null = null;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    try {
      this.subClient = (redis as Redis).duplicate();
      this.subClient.on('message', (channel, message) => {
        try {
          const event = JSON.parse(message) as TypedDomainEvent;
          this.dispatch(event.name, event, false);
        } catch (e) {
          this.logger.warn(`Failed to parse redis event @ ${channel}: ${(e as Error).message}`);
        }
      });
    } catch (e) {
      this.logger.warn(`DomainEventBus redis subscriber init failed: ${(e as Error).message}`);
    }
  }

  on<T = unknown>(eventName: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventName)) this.handlers.set(eventName, new Set());
    this.handlers.get(eventName)!.add(handler as EventHandler);
    // subscribe to cross-instance broadcasts
    this.subClient
      ?.subscribe(`event:${eventName}`)
      .catch((e) => this.logger.warn(`redis subscribe failed event:${eventName}`, e));
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
      await this.redis.publish(`event:${full.name}`, JSON.stringify(full));
      if (full.channel) {
        await this.redis.publish(`sync:${full.channel}`, JSON.stringify(full));
      }
    } catch (e) {
      this.logger.warn(`redis publish failed: ${(e as Error).message}`);
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
      await this.subClient?.quit();
    } catch {
      /* noop */
    }
  }
}
