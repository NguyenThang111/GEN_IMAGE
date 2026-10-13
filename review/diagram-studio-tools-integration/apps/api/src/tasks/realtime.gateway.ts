import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthUser } from '../auth/auth.types';
import { UsersService } from '../users/users.service';
import { isCurrentSession } from '../auth/session-version';

export type OnlineMember = Pick<AuthUser, 'id' | 'username' | 'displayName'>;

@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly jwt: JwtService, private readonly users: UsersService) {}
  @WebSocketServer() server!: Server;
  private readonly online = new Map<string, { user: OnlineMember; socketIds: Set<string> }>();
  afterInit(server: Server) {
    server.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth.token as string | undefined;
        if (!token) return next(new Error('Unauthorized'));
        const payload = await this.jwt.verifyAsync(token);
        if (!payload.sub) return next(new Error('Unauthorized'));
        const user = await this.users.findActiveById(payload.sub);
        if (!user || !isCurrentSession(payload, user)) return next(new Error('Unauthorized'));
        socket.data.user = { id: user.id, username: user.username, displayName: user.displayName, role: user.role };
        next();
      } catch { next(new Error('Unauthorized')); }
    });
  }
  handleConnection(socket: Socket) {
    const user = socket.data.user as AuthUser;
    const current = this.online.get(user.id) ?? {
      user: { id: user.id, username: user.username, displayName: user.displayName },
      socketIds: new Set<string>(),
    };
    current.socketIds.add(socket.id);
    this.online.set(user.id, current);
    this.emitPresence();
  }
  handleDisconnect(socket: Socket) {
    const user = socket.data.user as AuthUser | undefined;
    if (!user) return;
    const current = this.online.get(user.id);
    if (!current) return;
    current.socketIds.delete(socket.id);
    if (!current.socketIds.size) this.online.delete(user.id);
    this.emitPresence();
  }
  private emitPresence() {
    this.server?.emit('presence.updated', [...this.online.values()].map(({ user }) => user));
  }
  emitTask(event: string, task: unknown) { this.server?.emit(event, task); }
  emitInventory(event: string, payload: unknown) { this.server?.emit(event, payload); }
  emitWorklog(event: string, payload: unknown) { this.server?.emit(event, payload); }
}
