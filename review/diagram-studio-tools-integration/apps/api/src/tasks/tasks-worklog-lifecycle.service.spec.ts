import { TaskEventType } from './task-event.entity';
import { TaskReviewResult, TaskStatus } from './task.entity';
import { TasksService } from './tasks.service';
import { UserRole } from '../users/user.entity';

describe('TasksService Worklog lifecycle', () => {
  it('allows an authenticated Member to move a Backlog Task to Active', async () => {
    const task = { id: 'backlog-id', status: TaskStatus.BACKLOG };
    const manager = { save: jest.fn(async (value) => value) };
    const realtime = { emitTask: jest.fn() };
    const service = Object.create(TasksService.prototype) as TasksService;
    const audit = jest.fn(async () => undefined);
    const mutate = jest.fn(async (_id, actor, expectedStatus, action) => {
      expect(actor.role).toBe(UserRole.MEMBER);
      expect(expectedStatus).toBe(TaskStatus.BACKLOG);
      await action(manager, task);
      return task;
    });
    Object.assign(service, { realtime, audit, mutate });
    const actor = { id: 'vinh-id', username: 'vinh', displayName: 'VINH', role: UserRole.MEMBER };

    const result = await service.start(task.id, actor);

    expect(result.status).toBe(TaskStatus.ACTIVE);
    expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ status: TaskStatus.ACTIVE }));
    expect(audit).toHaveBeenCalledWith(manager, task.id, actor.id, TaskEventType.EDITED, {
      changes: { status: { from: TaskStatus.BACKLOG, to: TaskStatus.ACTIVE } },
    });
    expect(realtime.emitTask).toHaveBeenCalledWith('task.updated', result);
  });

  it('moves linked Backlog and Review Tasks to Active and emits their updates', async () => {
    const backlog = { id: 'backlog-id', status: TaskStatus.BACKLOG };
    const active = { id: 'active-id', status: TaskStatus.ACTIVE };
    const review = { id: 'review-id', status: TaskStatus.DONE, doneById: 'phu-id', doneAt: new Date() };
    const manager = {
      createQueryBuilder: jest.fn(() => ({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn(async () => [backlog, active, review]),
      })),
      save: jest.fn(async (value) => value),
    };
    const dataSource = { transaction: jest.fn(async (action) => action(manager)) };
    const realtime = { emitTask: jest.fn() };
    const service = Object.create(TasksService.prototype) as TasksService;
    Object.assign(service, { dataSource, realtime });
    const audit = jest.fn(async () => undefined);
    const getVisible = jest.fn(async (id: string) => ({ id, status: TaskStatus.ACTIVE }));
    Object.assign(service, { audit, getVisible });
    const actor = { id: 'phu-id', username: 'phu', displayName: 'PHÚ', role: UserRole.MEMBER };

    const result = await service.startFromWorklog([backlog.id, active.id, review.id], actor, 'worklog-id');

    expect(manager.save).toHaveBeenCalledTimes(2);
    expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ id: backlog.id, status: TaskStatus.ACTIVE }));
    expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ id: review.id, status: TaskStatus.ACTIVE, doneById: null, doneAt: null }));
    expect(audit).toHaveBeenCalledWith(manager, backlog.id, actor.id, TaskEventType.EDITED, expect.objectContaining({
      source: 'WORKLOG_LINKED',
      worklogId: 'worklog-id',
    }));
    expect(getVisible).toHaveBeenCalledWith(backlog.id);
    expect(getVisible).toHaveBeenCalledWith(review.id);
    expect(realtime.emitTask).toHaveBeenCalledWith('task.updated', expect.objectContaining({ id: backlog.id, status: TaskStatus.ACTIVE }));
    expect(result).toEqual([{ id: backlog.id, status: TaskStatus.ACTIVE }, { id: review.id, status: TaskStatus.ACTIVE }]);
  });

  it('lets a Worklog owner move an open Task to Review', async () => {
    const task = { id: 'active-id', status: TaskStatus.ACTIVE, doneById: null, doneAt: null };
    const manager = { save: jest.fn(async (value) => value) };
    const dataSource = { transaction: jest.fn(async (action) => action(manager)) };
    const realtime = { emitTask: jest.fn() };
    const service = Object.create(TasksService.prototype) as TasksService;
    const audit = jest.fn(async () => undefined);
    const lock = jest.fn(async () => task);
    const getVisible = jest.fn(async () => ({ ...task }));
    Object.assign(service, { dataSource, realtime, audit, lock, getVisible });
    const actor = { id: 'phu-id', username: 'phu', displayName: 'PHÚ', role: UserRole.MEMBER };

    const result = await service.requestReviewFromWorklog(task.id, actor, 'worklog-id');

    expect(result.status).toBe(TaskStatus.DONE);
    expect(result.reviewResult).toBe(TaskReviewResult.PENDING);
    expect(manager.save).toHaveBeenCalledWith(expect.objectContaining({ status: TaskStatus.DONE, doneById: actor.id, doneAt: expect.any(Date) }));
    expect(audit).toHaveBeenCalledWith(manager, task.id, actor.id, TaskEventType.REVIEWED, expect.objectContaining({ source: 'WORKLOG', worklogId: 'worklog-id' }));
    expect(realtime.emitTask).toHaveBeenCalledWith('task.updated', expect.objectContaining({ status: TaskStatus.DONE }));
  });

  it('lets an assigned Member request Task Review when a completed Worklog is linked', async () => {
    const task = { id: 'active-id', status: TaskStatus.ACTIVE, doneById: null, doneAt: null };
    const worklogQuery = { innerJoin: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getCount: jest.fn(async () => 1) };
    const manager = {
      save: jest.fn(async (value) => value),
      getRepository: jest.fn((entity) => entity.name === 'TaskAssignee'
        ? { exist: jest.fn(async () => true) }
        : { createQueryBuilder: jest.fn(() => worklogQuery) }),
    };
    const dataSource = { transaction: jest.fn(async (action) => action(manager)) };
    const realtime = { emitTask: jest.fn() };
    const service = Object.create(TasksService.prototype) as TasksService;
    const audit = jest.fn(async () => undefined);
    const lock = jest.fn(async () => task);
    const getVisible = jest.fn(async () => ({ ...task }));
    Object.assign(service, { dataSource, realtime, audit, lock, getVisible });
    const actor = { id: 'vinh-id', username: 'vinh', displayName: 'VINH', role: UserRole.MEMBER };

    const result = await service.requestReview(task.id, actor);

    expect(result.status).toBe(TaskStatus.DONE);
    expect(result.reviewResult).toBe(TaskReviewResult.PENDING);
    expect(worklogQuery.getCount).toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(manager, task.id, actor.id, TaskEventType.REVIEWED, expect.objectContaining({ source: 'TASK_MENU' }));
  });

  it('rejects Task Review when no completed Worklog is linked', async () => {
    const task = { id: 'active-id', status: TaskStatus.ACTIVE, doneById: null, doneAt: null };
    const worklogQuery = { innerJoin: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getCount: jest.fn(async () => 0) };
    const manager = {
      getRepository: jest.fn((entity) => entity.name === 'TaskAssignee'
        ? { exist: jest.fn(async () => true) }
        : { createQueryBuilder: jest.fn(() => worklogQuery) }),
    };
    const service = Object.create(TasksService.prototype) as TasksService;
    Object.assign(service, {
      dataSource: { transaction: jest.fn(async (action) => action(manager)) },
      lock: jest.fn(async () => task),
    });
    const actor = { id: 'vinh-id', username: 'vinh', displayName: 'VINH', role: UserRole.MEMBER };

    await expect(service.requestReview(task.id, actor)).rejects.toThrow('Task cần ít nhất một Worklog HOÀN THÀNH');
  });

  it('keeps a failed review inside Review and records the required reason', async () => {
    const task = { id: 'review-id', status: TaskStatus.DONE, reviewResult: TaskReviewResult.PENDING };
    const manager = {
      save: jest.fn(async (value) => ({ id: 'saved-id', ...value })),
      create: jest.fn((_entity, value) => value),
      find: jest.fn(async () => [{ userId: 'vinh-id' }]),
    };
    const service = Object.create(TasksService.prototype) as TasksService;
    const audit = jest.fn(async () => undefined);
    const getVisible = jest.fn(async () => ({ ...task }));
    Object.assign(service, {
      dataSource: { transaction: jest.fn(async (action) => action(manager)) },
      realtime: { emitTask: jest.fn() },
      audit,
      lock: jest.fn(async () => task),
      getVisible,
    });
    const admin = { id: 'admin-id', username: 'admin', displayName: 'Admin', role: UserRole.ADMIN };

    const result = await service.failReview(task.id, { reason: 'Thiếu bằng chứng kiểm thử' }, admin);

    expect(result).toMatchObject({ status: TaskStatus.DONE, reviewResult: TaskReviewResult.FAILED });
    expect(manager.create).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ body: 'KHÔNG ĐẠT: Thiếu bằng chứng kiểm thử' }));
    expect(audit).toHaveBeenCalledWith(manager, task.id, admin.id, TaskEventType.REVIEWED, expect.objectContaining({ result: TaskReviewResult.FAILED }));
  });

  it('does not allow a Member to set a failed review result', async () => {
    const service = Object.create(TasksService.prototype) as TasksService;
    const member = { id: 'vinh-id', username: 'vinh', displayName: 'VINH', role: UserRole.MEMBER };

    await expect(service.failReview('review-id', { reason: 'Không đạt' }, member)).rejects.toThrow();
  });

  it('allows Admin to return a failed result to pending Review', async () => {
    const task = { id: 'review-id', status: TaskStatus.DONE, reviewResult: TaskReviewResult.FAILED };
    const manager = { save: jest.fn(async (value) => value) };
    const service = Object.create(TasksService.prototype) as TasksService;
    const audit = jest.fn(async () => undefined);
    Object.assign(service, {
      dataSource: { transaction: jest.fn(async (action) => action(manager)) },
      realtime: { emitTask: jest.fn() },
      audit,
      lock: jest.fn(async () => task),
      getVisible: jest.fn(async () => ({ ...task })),
    });
    const admin = { id: 'admin-id', username: 'admin', displayName: 'Admin', role: UserRole.ADMIN };

    const result = await service.resetReview(task.id, admin);

    expect(result.reviewResult).toBe(TaskReviewResult.PENDING);
    expect(audit).toHaveBeenCalledWith(manager, task.id, admin.id, TaskEventType.REVIEWED, { result: TaskReviewResult.PENDING });
  });
});
