import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../infrastructure/redis/redis.module';
import { SyncGateway } from './sync.gateway';

/**
 * Sync service — bridges Redis Pub/Sub events to connected WebSocket clients.
 *
 * Flow:
 *   1) DomainEventBus publishes payload → Redis channel `sync:class:xxx`
 *   2) This service subscribes and fans out to SyncGateway.broadcast()
 *   3) Clients receive SyncEnvelope and call `QueryClient.invalidateQueries()` + optimistic merge
 */
@Injectable()
export class SyncService implements OnModuleInit {
  private readonly logger = new Logger(SyncService.name);
  private readonly subscriber: Redis;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly gateway: SyncGateway,
  ) {
    this.subscriber = redis.duplicate();
  }

  async onModuleInit() {
    this.subscriber.on('pmessage', (_pattern, channel, message) => {
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
    await this.subscriber.psubscribe('sync:*');
    this.logger.log('Listening on sync:* channels for WebSocket fan-out', SyncService.name);
  }
}
