import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { UserRole } from '../users/user.entity';

describe('JwtStrategy account status', () => {
  const profile = { id: 'user-1', username: 'phongbk', displayName: 'PHONG BK', role: UserRole.MEMBER };
  const payload = { ...profile, sub: profile.id, role: UserRole.ADMIN };
  const findActiveById = jest.fn();
  const strategy = new JwtStrategy({ get: () => 'test-secret' } as never, { findActiveById } as never);

  beforeEach(() => findActiveById.mockReset());

  it('rejects an old token when its account is inactive or missing', async () => {
    findActiveById.mockResolvedValue(null);
    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    expect(findActiveById).toHaveBeenCalledWith(profile.id);
  });

  it('uses the current active profile instead of stale token permissions', async () => {
    findActiveById.mockResolvedValue(profile);
    await expect(strategy.validate(payload)).resolves.toEqual(profile);
  });

  it('rejects a token without a user ID', async () => {
    await expect(strategy.validate({ ...payload, sub: '' })).rejects.toThrow(UnauthorizedException);
    expect(findActiveById).not.toHaveBeenCalled();
  });

  it.each([undefined, 0, 1])('rejects revoked session version %s', async sessionVersion => {
    findActiveById.mockResolvedValue({ ...profile, sessionVersion: 2 });
    await expect(strategy.validate({ ...payload, sessionVersion })).rejects.toThrow(UnauthorizedException);
  });

  it('accepts the new session without exposing its version', async () => {
    findActiveById.mockResolvedValue({ ...profile, sessionVersion: 2 });
    await expect(strategy.validate({ ...payload, sessionVersion: 2 })).resolves.toEqual(profile);
  });
});
