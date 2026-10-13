import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { IsNull } from 'typeorm';
import { UserRole } from '../users/user.entity';
import { TaskDraft } from './task-draft.entity';
import { UpdateTaskDraftDto } from './task.dto';
import { TasksService } from './tasks.service';

const admin = { id: 'admin', username: 'admin', displayName: 'Admin', role: UserRole.ADMIN };
const input = { topic: ' Easyscan ', description: ' Fix board ', suggestion: ' Schematic link ', criteria: [' Check jack ', 'Check jack'], assigneeIds: [] };
function setup() {
  const draft = { id: 'draft', topic: 'Old', description: 'Old note', suggestion: null, assigneeIds: ['old-user'], criteria: ['Old check'], deletedAt: null, deletedById: null, createdById: 'creator', createdAt: new Date('2026-09-01'), importKey: 'import-1', dueDate: '2026-10-01', pointFactors: { risk: 1 }, sourceStatus: 'INIT' };
  const manager = { findOne: jest.fn().mockResolvedValue(draft), save: jest.fn(async row => row) };
  const dataSource = { transaction: jest.fn(async callback => callback(manager)) };
  const realtime = { emitTask: jest.fn() };
  const assertWorkplaceAssignees = jest.fn();
  const createBacklogTask = jest.fn();
  const service = Object.create(TasksService.prototype) as TasksService;
  Object.assign(service, { dataSource, realtime, assertWorkplaceAssignees, createBacklogTask });
  return { service, draft, manager, dataSource, realtime, assertWorkplaceAssignees, createBacklogTask };
}

describe('Save Backlog draft without promotion', () => {
  it('keeps historical assignees without requiring them to remain active', async () => {
    const s = setup(); s.assertWorkplaceAssignees.mockRejectedValue(new BadRequestException());
    const result = await s.service.updateDraft('draft', { ...input, assigneeIds: ['old-user'] }, admin);
    expect(result.assigneeIds).toEqual(['old-user']); expect(s.assertWorkplaceAssignees).not.toHaveBeenCalled();
  });
  it('validates only additions while enforcing total assignee limit', async () => {
    const s = setup(); await s.service.updateDraft('draft', { ...input, assigneeIds: ['old-user', 'new-user'] }, admin);
    expect(s.assertWorkplaceAssignees).toHaveBeenCalledWith(s.manager, ['new-user']);
    await expect(s.service.updateDraft('draft', { ...input, assigneeIds: ['old-user', 'a', 'b', 'c'] }, admin)).rejects.toThrow();
  });
  it('updates editable fields while keeping identity, metadata and Backlog draft', async () => {
    const s = setup(); const before = { ...s.draft };
    const result = await s.service.updateDraft('draft', input, admin);
    expect(s.manager.findOne).toHaveBeenCalledWith(TaskDraft, { where: { id: 'draft', deletedAt: IsNull() }, lock: { mode: 'pessimistic_write' } });
    expect(result).toEqual({ ...before, topic: 'Easyscan', description: 'Fix board', suggestion: 'Schematic link', criteria: ['Check jack'], assigneeIds: [] });
    expect(s.manager.save).toHaveBeenCalledTimes(1);
    expect(s.createBacklogTask).not.toHaveBeenCalled();
    expect(s.realtime.emitTask).toHaveBeenCalledWith('task.draft.updated', result);
  });
  it('allows clearing description, suggestion, checklist and assignees', async () => {
    const s = setup();
    const result = await s.service.updateDraft('draft', { ...input, description: '', suggestion: '', criteria: [' '] }, admin);
    expect(result).toMatchObject({ description: null, suggestion: null, criteria: [], assigneeIds: [], deletedAt: null });
    expect(s.assertWorkplaceAssignees).not.toHaveBeenCalled();
  });
  it('checks assignee permissions before saving', async () => {
    const s = setup(); s.assertWorkplaceAssignees.mockRejectedValue(new BadRequestException());
    await expect(s.service.updateDraft('draft', { ...input, assigneeIds: ['inactive-user'] }, admin)).rejects.toBeInstanceOf(BadRequestException);
    expect(s.manager.save).not.toHaveBeenCalled();
    expect(s.realtime.emitTask).not.toHaveBeenCalled();
  });
  it('blocks members before the transaction', async () => {
    const s = setup();
    await expect(s.service.updateDraft('draft', input, { ...admin, role: UserRole.MEMBER })).rejects.toBeInstanceOf(ForbiddenException);
    expect(s.dataSource.transaction).not.toHaveBeenCalled();
  });
  it('does not recreate deleted/promoted or missing drafts', async () => {
    const s = setup(); s.manager.findOne.mockResolvedValue(null);
    await expect(s.service.updateDraft('draft', input, admin)).rejects.toBeInstanceOf(NotFoundException);
    expect(s.manager.save).not.toHaveBeenCalled();
  });
  it('rejects blank topics and excessive checklist', async () => {
    const s = setup();
    await expect(s.service.updateDraft('draft', { ...input, topic: ' ' }, admin)).rejects.toBeInstanceOf(BadRequestException);
    await expect(s.service.updateDraft('draft', { ...input, criteria: Array.from({ length: 11 }, (_, i) => String(i)) }, admin)).rejects.toBeInstanceOf(BadRequestException);
    expect(s.manager.save).not.toHaveBeenCalled();
  });
  it('does not emit a success event when saving fails', async () => {
    const s = setup(); s.manager.save.mockRejectedValue(new Error('DB failure'));
    await expect(s.service.updateDraft('draft', input, admin)).rejects.toThrow('DB failure');
    expect(s.realtime.emitTask).not.toHaveBeenCalled();
  });
  it('validates incomplete drafts but rejects invalid field types and lengths', async () => {
    const minimal = { topic: 'Title', description: '', suggestion: '', criteria: [], assigneeIds: [] };
    expect(await validate(Object.assign(new UpdateTaskDraftDto(), minimal))).toHaveLength(0);
    for (const invalid of [{ topic: '' }, { topic: 'x'.repeat(81) }, { description: 'x'.repeat(2001) }, { suggestion: 'x'.repeat(2001) }, { criteria: null }, { assigneeIds: null }, { assigneeIds: ['not-uuid'] }]) {
      expect((await validate(Object.assign(new UpdateTaskDraftDto(), minimal, invalid))).length).toBeGreaterThan(0);
    }
  });
});
