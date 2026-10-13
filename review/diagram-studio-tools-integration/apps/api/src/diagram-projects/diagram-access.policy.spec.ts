import { requireDiagramEditor } from './diagram-access.policy';
import { UserRole } from '../users/user.entity';

describe('Diagram edit access', () => {
  it.each(['thang', 'phu', 'THANG'])('allows existing Dev %s', username => {
    expect(() => requireDiagramEditor({ id: 'dev', username, displayName: 'Dev', role: UserRole.MEMBER })).not.toThrow();
  });
  it('allows Admin', () => {
    expect(() => requireDiagramEditor({ id: 'admin', username: 'admin', displayName: 'Admin', role: UserRole.ADMIN })).not.toThrow();
  });
  it.each(['phongbk', 'minhbk', 'unknown'])('does not grant Admin privileges to %s', username => {
    expect(() => requireDiagramEditor({ id: 'member', username, displayName: 'Member', role: UserRole.MEMBER })).toThrow('Chỉ Admin hoặc Dev');
  });
});
