import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { IsNull } from 'typeorm';
import { UserRole } from '../users/user.entity';
import { TaskDraft } from './task-draft.entity';
import { Task, TaskStatus } from './task.entity';
import { TaskPriority } from './task-priority';
import { UpdateTaskPriorityDto } from './task.dto';
import { TasksService } from './tasks.service';

const admin = { id: 'admin', username: 'admin', displayName: 'Admin', role: UserRole.ADMIN };
function setup(draft = false) {
  const row = { id: 'id', priority: TaskPriority.NORMAL, status: TaskStatus.BACKLOG, title: '[Easyscan] Work', topic: '[Easyscan] Work', description: 'Description', suggestion: 'Link', criteria: ['Check'], assigneeIds: [], earnedPoint: '100', doneAt: null, deletedAt: null, sourcePriority: 'Urgent', sourceStatus: 'INIT' };
  const manager = { findOne: jest.fn().mockResolvedValue(row), save: jest.fn(async value => value), findOneByOrFail: jest.fn().mockResolvedValue(admin) };
  const dataSource = { transaction: jest.fn(async callback => callback(manager)) };
  const realtime = { emitTask: jest.fn() };
  const audit = jest.fn();
  const service = Object.create(TasksService.prototype) as TasksService;
  Object.assign(service, { dataSource, realtime, audit, getVisible: jest.fn(async () => row), email: { queue: jest.fn() }, queueTaskAssigned: jest.fn() });
  const update = (priority: TaskPriority, actor = admin) => draft ? service.setDraftPriority('id', priority, actor) : service.setPriority('id', priority, actor);
  return { row, manager, dataSource, realtime, audit, service, update };
}

describe.each([false, true])('Task priority (draft=%s)', draft => {
  it.each(Object.values(TaskPriority))('persists %s only, preserving all other data', async priority => {
    const s = setup(draft); s.row.priority = TaskPriority.LOW;
    const before = { ...s.row };
    const result = await s.update(priority);
    expect(result).toEqual({ ...before, priority });
    expect(s.manager.findOne).toHaveBeenCalledWith(draft ? TaskDraft : Task, { where: { id: 'id', deletedAt: IsNull() }, lock: { mode: 'pessimistic_write' } });
    if (priority !== TaskPriority.LOW) {
      expect(s.manager.save).toHaveBeenCalledTimes(1);
      expect(s.realtime.emitTask).toHaveBeenCalledWith(draft ? 'task.draft.updated' : 'task.updated', result);
      if (!draft) expect(s.audit).toHaveBeenCalledWith(s.manager, 'id', admin.id, 'EDITED', { changes: { priority: { from: TaskPriority.LOW, to: priority } } });
    }
  });
  it('blocks members before opening a transaction', async () => {
    const s = setup(draft);
    await expect(s.update(TaskPriority.HIGH, { ...admin, role: UserRole.MEMBER })).rejects.toBeInstanceOf(ForbiddenException);
    expect(s.dataSource.transaction).not.toHaveBeenCalled();
  });
  it('rejects unsupported values', async () => {
    const s = setup(draft);
    for (const value of [null, undefined, 'URGENT', 'high', '']) await expect(s.update(value as TaskPriority)).rejects.toBeInstanceOf(BadRequestException);
    expect(s.manager.save).not.toHaveBeenCalled();
  });
  it('rejects missing/deleted rows', async () => {
    const s = setup(draft); s.manager.findOne.mockResolvedValue(null);
    await expect(s.update(TaskPriority.HIGH)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('does not save or broadcast unchanged priority', async () => {
    const s = setup(draft); await s.update(TaskPriority.NORMAL);
    expect(s.manager.save).not.toHaveBeenCalled(); expect(s.audit).not.toHaveBeenCalled(); expect(s.realtime.emitTask).not.toHaveBeenCalled();
  });
  it('does not broadcast failed transactions', async () => {
    const s = setup(draft); s.manager.save.mockRejectedValue(new Error('DB failed'));
    await expect(s.update(TaskPriority.HIGH)).rejects.toThrow('DB failed'); expect(s.realtime.emitTask).not.toHaveBeenCalled();
  });
});

describe('Priority lifecycle', () => {
  it.each([TaskStatus.BACKLOG, TaskStatus.ACTIVE, TaskStatus.DONE, TaskStatus.COMPLETE])('preserves status %s', async status => {
    const s = setup(); s.row.status = status; await s.update(TaskPriority.HIGH); expect(s.row.status).toBe(status);
  });
  it('rejects archived Tasks', async () => {
    const s = setup(); s.row.status = TaskStatus.ARCHIVED;
    await expect(s.update(TaskPriority.HIGH)).rejects.toBeInstanceOf(BadRequestException);
  });
  it.each(['promote', 'claim'])('keeps draft priority during %s', async action => {
    const s = setup(true); s.row.priority = TaskPriority.HIGH;
    const createBacklogTask = jest.fn().mockResolvedValue({ id: 'new-task' });
    Object.assign(s.service, { createBacklogTask });
    if (action === 'promote') await s.service.promoteDraft('id', { title: 'Task', note: 'Note', criteria: ['Check'], assigneeIds: ['thang'] }, admin);
    else await s.service.claimDraft('id', { ...admin, username: 'thang', role: UserRole.MEMBER });
    expect(createBacklogTask.mock.calls[0][4]).toBe(TaskPriority.HIGH);
  });
  it('defaults newly created Tasks to normal priority', async () => {
    const s = setup(); const create = jest.fn((entity, value) => ({ ...value, id: 'new' }));
    Object.assign(s.service, { assertWorkplaceAssignees: jest.fn() });
    const result = await (s.service as any).createBacklogTask({ ...s.manager, create }, { title: 'Topic', note: 'Note', criteria: ['Check'], assigneeIds: ['user'] }, admin);
    expect(result.priority).toBe(TaskPriority.NORMAL); expect(result.status).toBe(TaskStatus.BACKLOG);
  });
  it('validates the three supported priorities without allowing null', async () => {
    for (const priority of Object.values(TaskPriority)) expect(await validate(Object.assign(new UpdateTaskPriorityDto(), { priority }))).toHaveLength(0);
    for (const priority of [undefined, null, 'URGENT', '']) expect((await validate(Object.assign(new UpdateTaskPriorityDto(), { priority }))).length).toBeGreaterThan(0);
  });
});
