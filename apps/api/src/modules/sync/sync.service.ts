import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { REDIS_CLIENT, PubSubClient } from '../../infrastructure/redis/redis.module';
import { SyncGateway } from './sync.gateway';

/**
 * Sync service — bridges pub/sub events to connected WebSocket clients.
 *
 * 有真 Redis 时跨实例广播；没 Redis 时走内存 EventEmitter（单进程够用）。
 *
 * Flow:
 *   1) DomainEventBus.publish(`sync:class:xxx`, payload)
 *   2) 这里 psubscribe('sync:*') 收到 → SyncGateway.broadcast(room, envelope)
 *   3) 前端收到后 invalidateQueries + 乐观合并
 */
@Injectable()
export class SyncService implements OnModuleInit {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: PubSubClient,
    private readonly gateway: SyncGateway,
  ) {}

  async onModuleInit() {
    await this.redis.psubscribe?.('sync:*', (_pattern, channel, message) => {
      try {
        const event = JSON.parse(message);
        const channelName = channel.replace(/^sync:/, '');
        this.gateway.broadcast(channelName, {
          type: 'DATA_CHANGED',
          channel: channelName,
          payload: {
            entity: event.payload?.entity ?? 'UNKNOWN',
            action: event.payload?.action ?? 'UPDATED',
            data: event.payload ?? event,
            issuerId: undefined,
            timestamp: event.occurredAt ?? new Date().toISOString(),
          },
        });
      } catch (e) {
        this.logger.warn(`Failed to dispatch sync @ ${channel}: ${(e as Error).message}`);
      }
    });
    this.logger.log('Listening on sync:* channels for WebSocket fan-out', SyncService.name);
  }
}
