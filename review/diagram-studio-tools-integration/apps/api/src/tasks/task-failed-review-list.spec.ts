import { TasksService } from './tasks.service';
import { Task, TaskReviewResult, TaskStatus } from './task.entity';
import { TaskEvent, TaskEventType } from './task-event.entity';
import { UserRole } from '../users/user.entity';

function query(rows: unknown[]) {
  const builder: any = { getRawMany: jest.fn().mockResolvedValue(rows) };
  for (const name of ['select','addSelect','where','andWhere','groupBy','innerJoin','leftJoin','distinctOn','orderBy','addOrderBy']) builder[name] = jest.fn().mockReturnValue(builder);
  return builder;
}

describe('Failed Task list evidence', () => {
  it('batch-loads the latest failed event only for currently failed tasks', async () => {
    const failed = { id: 'failed', status: TaskStatus.DONE, reviewResult: TaskReviewResult.FAILED };
    const pending = { id: 'pending', status: TaskStatus.DONE, reviewResult: TaskReviewResult.PENDING };
    const active = { id: 'active', status: TaskStatus.ACTIVE, reviewResult: TaskReviewResult.FAILED };
    const missing = { id: 'missing', status: TaskStatus.DONE, reviewResult: TaskReviewResult.FAILED };
    const reviewedAt = new Date('2026-10-01T10:30:00Z');
    const events = query([{ taskId: 'failed', reason: 'Thiếu test', reviewedAt, reviewerName: 'Admin' }]);
    const comments = query([]), worklogs = query([{ taskId: 'failed', count: '2', hours: '5' }]);
    const service = Object.create(TasksService.prototype) as any;
    const getRepository = jest.fn(entity => ({ createQueryBuilder: () => entity === TaskEvent ? events : worklogs }));
    Object.assign(service, { comments: { createQueryBuilder: () => comments }, dataSource: { getRepository } });
    const result = await service.withCommentCounts([failed, pending, active, missing]);
    expect(events.where).toHaveBeenCalledWith('event.taskId IN (:...failedIds)', { failedIds: ['failed','missing'] });
    expect(events.distinctOn).toHaveBeenCalledWith(['event.taskId']);
    expect(events.andWhere).toHaveBeenCalledWith('event.type = :type', { type: TaskEventType.REVIEWED });
    expect(events.andWhere).toHaveBeenCalledWith("event.payload ->> 'result' = :result", { result: TaskReviewResult.FAILED });
    expect(events.addOrderBy).toHaveBeenCalledWith('event.createdAt', 'DESC');
    expect(events.getRawMany).toHaveBeenCalledTimes(1);
    expect(result[0]).toMatchObject({ failedReview: { reason: 'Thiếu test', reviewedAt, reviewerName: 'Admin' }, worklogCount: 2, worklogHours: 5 });
    expect(result.slice(1).every((task: Task) => task.failedReview === null)).toBe(true);
  });

  it('does not query review events when no failed tasks are listed', async () => {
    const builder = query([]), getRepository = jest.fn(() => ({ createQueryBuilder: () => builder }));
    const service = Object.create(TasksService.prototype) as any;
    Object.assign(service, { comments: { createQueryBuilder: () => builder }, dataSource: { getRepository } });
    await service.withCommentCounts([{ id:'active', status:TaskStatus.ACTIVE }]);
    expect(getRepository).not.toHaveBeenCalledWith(TaskEvent);
    expect(await service.withCommentCounts([])).toEqual([]);
  });
});

describe('Retry failed Task preserves evidence', () => {
  it.each([UserRole.ADMIN, UserRole.MEMBER])('allows %s without mutating Worklog or deleting history', async role => {
    const task = { id:'task', status:TaskStatus.DONE, reviewResult:TaskReviewResult.FAILED, doneAt:new Date(), doneById:'dev', worklogHours:5 };
    const manager = { existsBy: jest.fn().mockResolvedValue(true), save: jest.fn(), delete: jest.fn(), getRepository: jest.fn() };
    const service = Object.create(TasksService.prototype) as any;
    const audit = jest.fn();
    Object.assign(service, { mutate: async (_id: string, _actor: unknown, expected: TaskStatus, action: any) => { expect(expected).toBe(TaskStatus.DONE); await action(manager, task); return task; }, audit, realtime:{emitTask:jest.fn()} });
    await service.reopen('task', { id:'dev', role });
    expect(task).toMatchObject({ status:TaskStatus.ACTIVE, reviewResult:null, worklogHours:5 });
    expect(manager.save).toHaveBeenCalledWith(task);
    expect(manager.delete).not.toHaveBeenCalled(); expect(manager.getRepository).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(manager,'task','dev',TaskEventType.REOPENED,expect.any(Object));
  });

  it('rejects an unrelated member', async () => {
    const service = Object.create(TasksService.prototype) as any;
    const manager = { existsBy: async () => false, save: jest.fn() };
    Object.assign(service, { mutate: async (_id: string, _actor: unknown, _expected: TaskStatus, action: any) => action(manager,{ reviewResult:TaskReviewResult.FAILED }) });
    await expect(service.reopen('task',{id:'other',role:UserRole.MEMBER})).rejects.toThrow('Dev chỉ mở lại');
    expect(manager.save).not.toHaveBeenCalled();
  });
});
