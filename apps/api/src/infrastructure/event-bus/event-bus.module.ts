import { Global, Module } from '@nestjs/common';
import { DomainEventBus } from '../../common/domain-event/domain-event-bus.service';

/**
 * Wrap the event bus in its own module so it can depend on Redis
 * without creating circular imports (CommonModule imports it).
 */
@Global()
@Module({
  providers: [DomainEventBus],
  exports: [DomainEventBus],
})
export class EventBusModule {}
