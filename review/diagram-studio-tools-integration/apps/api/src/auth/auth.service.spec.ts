import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

describe('AuthService session version', () => {
  it('signs the current DB session version and does not return secrets in the profile', async () => {
    const user = { id: 'user', username: 'admin', displayName: 'Admin', role: 'ADMIN', isActive: true, passwordHash: await bcrypt.hash('test-password', 4), sessionVersion: 3 };
    const signAsync = jest.fn().mockResolvedValue('test-token');
    const service = new AuthService({ findByUsernameWithPassword: async () => user } as never, { signAsync } as never);
    const result = await service.login('admin', 'test-password');
    expect(signAsync).toHaveBeenCalledWith({ sub: user.id, id: user.id, username: user.username, displayName: user.displayName, role: user.role, sessionVersion: 3 });
    expect(result.user).not.toHaveProperty('sessionVersion');
    expect(result.user).not.toHaveProperty('passwordHash');
  });
});
