import {
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsResponse,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigType } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { jwtConfig } from '../../config/jwt.config';
import type { SyncEnvelope } from '@shared/dto';

/**
 * Cross-browser WebSocket gateway. Namespace `/ws/sync`.
 * Clients can SUBSCRIBE to class:xxx, teacher:xxx, user:xxx channels.
 */
@WebSocketGateway({
  namespace: '/ws/sync',
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
  pingInterval: 20000,
  pingTimeout: 60000,
})
export class SyncGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(SyncGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    @Inject(jwtConfig.KEY) private readonly cfg: ConfigType<typeof jwtConfig>,
  ) {}

  afterInit() {
    this.logger.log('WebSocket SyncGateway initialized');
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers.authorization ?? '').replace(/^Bearer\s+/i, '') ||
        (client.handshake.query?.token as string) ||
        '';
      if (!token) {
        client.emit('message', { type: 'ERROR', payload: 'missing token' });
        client.disconnect(true);
        return;
      }
      const payload = await this.jwt.verifyAsync(token, { secret: this.cfg.secret });
      (client as any).userId = payload.sub ?? payload.id;
      (client as any).channels = new Set<string>();
      this.logger.log(`WS connect user=${(client as any).userId}`);
    } catch (e) {
      client.emit('message', { type: 'ERROR', payload: 'invalid token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const id = (client as any).userId ?? 'anonymous';
    this.logger.log(`WS disconnect user=${id}`);
  }

  @SubscribeMessage('event')
  onEvent(@MessageBody() data: SyncEnvelope): WsResponse<unknown> {
    return { event: 'pong', data: { ok: true, receivedAt: new Date().toISOString(), data } };
  }

  @SubscribeMessage('SUBSCRIBE')
  subscribe(client: Socket, payload: { channel: string }): WsResponse<string> {
    const ch = payload?.channel;
    if (!ch) return { event: 'SUBSCRIBE', data: 'empty channel ignored' };
    const channels = (client as any).channels as Set<string>;
    channels.add(ch);
    client.join(ch);
    return { event: 'SUBSCRIBE', data: `joined ${ch}` };
  }

  @SubscribeMessage('UNSUBSCRIBE')
  unsubscribe(client: Socket, payload: { channel: string }): WsResponse<string> {
    const ch = payload?.channel;
    if (!ch) return { event: 'UNSUBSCRIBE', data: 'empty channel ignored' };
    const channels = (client as any).channels as Set<string>;
    channels.delete(ch);
    client.leave(ch);
    return { event: 'UNSUBSCRIBE', data: `left ${ch}` };
  }

  @SubscribeMessage('PING')
  ping(): WsResponse<string> {
    return { event: 'PONG', data: new Date().toISOString() };
  }

  /** Called by SyncService on Redis pub/sub events. */
  broadcast<T>(room: string, envelope: SyncEnvelope<T>): void {
    this.server.to(room).emit('message', envelope);
  }
}
