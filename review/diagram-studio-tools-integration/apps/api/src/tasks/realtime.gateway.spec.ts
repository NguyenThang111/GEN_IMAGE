import { RealtimeGateway } from './realtime.gateway';

describe('RealtimeGateway presence', () => {
  it.each([undefined, 0, 1])('rejects a revoked socket session %s', async sessionVersion => {
    const gateway = new RealtimeGateway({ verifyAsync: async () => ({ sub: 'admin', sessionVersion }) } as never, { findActiveById: async () => ({ id: 'admin', sessionVersion: 2 }) } as never);
    const use = jest.fn(); gateway.afterInit({ use } as never);
    const next = jest.fn();
    await use.mock.calls[0][0]({ handshake: { auth: { token: 'revoked' } }, data: {} }, next);
    expect(next).toHaveBeenCalledWith(new Error('Unauthorized'));
  });

  it.each([true, false])('checks active account status at handshake: %s', async active => {
    const user = { id: 'user-1', username: 'phongbk', displayName: 'PHONG BK', role: 'MEMBER' };
    const findActiveById = jest.fn().mockResolvedValue(active ? user : null);
    const gateway = new RealtimeGateway({ verifyAsync: async () => ({ sub: user.id }) } as never, { findActiveById } as never);
    const use = jest.fn();
    gateway.afterInit({ use } as never);
    const socket = { handshake: { auth: { token: 'old-token' } }, data: {} };
    const next = jest.fn();
    await use.mock.calls[0][0](socket, next);
    expect(findActiveById).toHaveBeenCalledWith(user.id);
    if (active) {
      expect(next).toHaveBeenCalledWith();
      expect(socket.data).toEqual({ user });
    } else {
      expect(next).toHaveBeenCalledWith(new Error('Unauthorized'));
      expect(socket.data).toEqual({});
    }
  });

  it('deduplicates multiple sockets and removes a member after the last disconnect', () => {
    const gateway = new RealtimeGateway({} as never, {} as never);
    const emit = jest.fn();
    gateway.server = { emit } as never;
    const user = { id: 'user-1', username: 'quang', displayName: 'QUANG BK', role: 'MEMBER' };
    const first = { id: 'socket-1', data: { user } } as never;
    const second = { id: 'socket-2', data: { user } } as never;

    gateway.handleConnection(first);
    gateway.handleConnection(second);
    expect(emit).toHaveBeenLastCalledWith('presence.updated', [{ id: 'user-1', username: 'quang', displayName: 'QUANG BK' }]);

    gateway.handleDisconnect(first);
    expect(emit).toHaveBeenLastCalledWith('presence.updated', [{ id: 'user-1', username: 'quang', displayName: 'QUANG BK' }]);
    gateway.handleDisconnect(second);
    expect(emit).toHaveBeenLastCalledWith('presence.updated', []);
  });
});
