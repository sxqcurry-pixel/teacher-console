/**
 * Domain Event Bus — typed, lightweight in-process pub/sub.
 *
 * 1) Feature services publish typed events via `.publish(event)`.
 * 2) EventBusModule forwards them via Redis Pub/Sub so other instances +
 *    SyncGateway (WebSocket) can broadcast to clients.
 *
 * This decouples writes from side effects (caches invalidation, statistics,
 * billing, push notifications, AI report triggers).
 */
import type { DomainEvent } from '@shared/types';

export interface TypedDomainEvent<T = unknown> extends DomainEvent<T> {
  /** Redis channel — e.g. "class:cls_xxx" */
  channel?: string;
}

export type EventHandler<T = unknown> = (event: TypedDomainEvent<T>) => void | Promise<void>;
