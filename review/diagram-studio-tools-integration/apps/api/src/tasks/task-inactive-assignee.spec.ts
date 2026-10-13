import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../users/user.entity';
import { TaskAssignee } from './task-assignee.entity';
import { TaskStatus } from './task.entity';
import { TasksService } from './tasks.service';

const admin = { id: 'admin', username: 'admin', displayName: 'Admin', role: UserRole.ADMIN };
function setup() {
  const previous = [{ taskId: 'task', userId: 'inactive-old', position: 0, sharePercent: '100', assignedById: 'creator', assignedAt: new Date('2026-09-01') }];
  const task = { id: 'task', title: 'Old', note: 'Old note', status: TaskStatus.BACKLOG };
  const manager = { find: jest.fn().mockResolvedValue(previous), delete: jest.fn(), save: jest.fn(async row => row), create: jest.fn((_entity, row) => row) };
  const assertWorkplaceAssignees = jest.fn(async (_manager, ids: string[]) => { if (ids.some(id => id !== 'active-new')) throw new BadRequestException('Every assignee must be an active user'); });
  const service = Object.create(TasksService.prototype) as TasksService;
  const audit = jest.fn();
  Object.assign(service, { dataSource: { transaction: async (callback: (m: typeof manager) => Promise<unknown>) => callback(manager) }, lock: async () => task, getVisible: async () => task, realtime: { emitTask: jest.fn() }, audit, assertWorkplaceAssignees });
  return { service, manager, task, previous, audit, assertWorkplaceAssignees };
}
describe('Editing historical task assignments', () => {
  it('saves text with an unchanged inactive assignee without recreating assignment metadata', async () => {
    const s = setup(); await s.service.update('task', { title: 'Updated', assigneeIds: ['inactive-old'] }, admin);
    expect(s.task.title).toBe('Updated'); expect(s.assertWorkplaceAssignees).not.toHaveBeenCalled();
    expect(s.manager.delete).not.toHaveBeenCalled(); expect(s.manager.create).not.toHaveBeenCalled();
    expect(s.audit.mock.calls[0][4].changes).toEqual({ title: { from: 'Old', to: 'Updated' } });
  });
  it('allows removing all old assignees', async () => {
    const s = setup(); await s.service.update('task', { assigneeIds: [] }, admin);
    expect(s.manager.delete).toHaveBeenCalledWith(TaskAssignee, { taskId: 'task' });
    expect(s.assertWorkplaceAssignees).not.toHaveBeenCalled();
  });
  it('validates only newly assigned people and retains the old inactive selection', async () => {
    const s = setup(); await s.service.update('task', { assigneeIds: ['inactive-old', 'active-new'] }, admin);
    expect(s.assertWorkplaceAssignees).toHaveBeenCalledWith(s.manager, ['active-new']);
    expect(s.manager.create).toHaveBeenCalledWith(TaskAssignee, expect.objectContaining({ userId: 'inactive-old' }));
  });
  it('still blocks adding an inactive or missing account', async () => {
    const s = setup(); await expect(s.service.update('task', { assigneeIds: ['inactive-old', 'inactive-new'] }, admin)).rejects.toBeInstanceOf(BadRequestException);
    expect(s.manager.delete).not.toHaveBeenCalled(); expect(s.manager.save).not.toHaveBeenCalled();
  });
  it('still blocks members and more than three total assignees', async () => {
    const s = setup(); await expect(s.service.update('task', { assigneeIds: [] }, { ...admin, role: UserRole.MEMBER })).rejects.toBeInstanceOf(ForbiddenException);
    s.assertWorkplaceAssignees.mockResolvedValue(undefined);
    await expect(s.service.update('task', { assigneeIds: ['inactive-old', 'a', 'b', 'c'] }, admin)).rejects.toThrow();
    expect(s.manager.delete).not.toHaveBeenCalled();
  });
  it('deduplicates without treating existing IDs as new', async () => {
    const s = setup(); await s.service.update('task', { assigneeIds: ['inactive-old', 'inactive-old'] }, admin);
    expect(s.assertWorkplaceAssignees).not.toHaveBeenCalled(); expect(s.manager.delete).not.toHaveBeenCalled();
  });
});
