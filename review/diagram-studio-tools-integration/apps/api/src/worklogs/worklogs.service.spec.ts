import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TaskStatus } from '../tasks/task.entity';
import { UserRole } from '../users/user.entity';
import { WorklogComment } from './worklog-comment.entity';
import { WorklogStabilityStatus, WorklogStatus, WorklogType, WorklogValueLevel } from './worklog.entity';
import { WorklogWeekStatus } from './worklog-week.entity';
import { WorklogsService } from './worklogs.service';

describe('WorklogsService permissions and scoring', () => {
  const sourceTaskId = '11111111-1111-4111-8111-111111111111';
  const worklogs = {
    create: jest.fn((input) => input),
    save: jest.fn(async (input) => ({ ...input, id: input.id ?? 'saved-worklog-id' })),
    findOneBy: jest.fn(),
    count: jest.fn(async () => 0),
    findOne: jest.fn(),
  };
  const worklogWeeks = {
    create: jest.fn((input) => input),
    save: jest.fn(async (input) => ({ ...input, id: input.id ?? 'saved-week-id' })),
    findOneBy: jest.fn(async (): Promise<Record<string, unknown> | null> => null),
    createQueryBuilder: jest.fn(),
  };
  const users = {
    findOneBy: jest.fn(async ({ id }) => ({ id, username: id === 'giang-id' ? 'giang' : 'phu', displayName: id === 'giang-id' ? 'GIANG' : 'PHÚ', isActive: true })),
  };
  const tasks = { find: jest.fn(async (): Promise<Array<{ id: string; status: TaskStatus }>> => [{ id: sourceTaskId, status: TaskStatus.ACTIVE }]) };
  const taskLifecycle = { startFromWorklog: jest.fn(async () => []), requestReviewFromWorklog: jest.fn(async () => ({ status: TaskStatus.DONE })) };
  const realtime = { emitWorklog: jest.fn() };
  const dataSource = { transaction: jest.fn(), getRepository: jest.fn() };
  const systemNotifications = { create: jest.fn() };
  const service = new WorklogsService(worklogs as never, worklogWeeks as never, users as never, tasks as never, taskLifecycle as never, realtime as never, dataSource as never, systemNotifications as never);
  const admin = { id: 'admin-id', username: 'admin', displayName: 'Admin', role: UserRole.ADMIN };
  const phu = { id: 'phu-id', username: 'phu', displayName: 'PHÚ', role: UserRole.MEMBER };
  const openCriterion = { id: 'out-1', expected: 'Board hoạt động ổn định' };
  const achievedCriterion = { ...openCriterion, actual: '2 board đạt', achieved: true };
  const basic = {
    valueLevel: WorklogValueLevel.BASIC,
    primaryTaskId: sourceTaskId,
    taskIds: [sourceTaskId],
    outputCriteria: [openCriterion],
  };

  beforeAll(() => jest.useFakeTimers().setSystemTime(new Date('2026-08-20T03:00:00.000Z')));
  afterAll(() => jest.useRealTimers());
  beforeEach(() => { jest.clearAllMocks(); worklogs.count.mockResolvedValue(0); worklogWeeks.findOneBy.mockResolvedValue(null); });

  it('locks creation in a closed Sprint for Members and Admin', async () => {
    worklogWeeks.findOneBy.mockResolvedValue({ weekStart: '2026-08-17', status: WorklogWeekStatus.CLOSED });
    await expect(service.create({ ...basic, input: 'Việc Sprint đã chốt', startedAt: '2026-08-20T08:30:00+07:00', status: WorklogStatus.OPEN }, phu)).rejects.toThrow('Sprint đã chốt');
    await expect(service.create({ ...basic, primaryTaskId: undefined, taskIds: [], input: 'Admin bổ sung', startedAt: '2026-08-20T08:30:00+07:00', status: WorklogStatus.OPEN }, admin)).rejects.toThrow('Sprint đã chốt');
  });

  it('locks creation outside the current Sprint for Members and Admin', async () => {
    await expect(service.create({ ...basic, input: 'Việc Sprint cũ', startedAt: '2026-08-16T08:30:00+07:00', status: WorklogStatus.OPEN }, phu)).rejects.toThrow('Sprint hiện tại');
    await expect(service.create({ ...basic, primaryTaskId: undefined, taskIds: [], input: 'Việc Sprint tương lai', startedAt: '2026-09-01T08:30:00+07:00', status: WorklogStatus.OPEN }, admin)).rejects.toThrow('Sprint hiện tại');
  });

  it('lets Admin and Dev create a Worklog for the signed-in identity', async () => {
    const adminSaved = await service.create({ ...basic, primaryTaskId: undefined, taskIds: [], input: 'Admin review kế hoạch', startedAt: '2026-08-18T08:00:00+07:00', status: WorklogStatus.OPEN }, admin);
    expect(adminSaved).toMatchObject({ userId: 'admin-id', createdById: 'admin-id', input: 'Admin review kế hoạch', status: WorklogStatus.OPEN, tasks: [] });
    const saved = await service.create({ ...basic, input: 'Hàn board ScanBox', startedAt: '2026-08-19T08:30:00+07:00', status: WorklogStatus.OPEN }, phu);
    expect(saved).toMatchObject({ userId: 'phu-id', createdById: 'phu-id', input: 'Hàn board ScanBox', status: WorklogStatus.OPEN, point: null });
  });

  it('stores a Worklog comment and separates mention recipients from owner and Admin notifications', async () => {
    worklogs.findOne.mockResolvedValue({ id: 'worklog-id', userId: phu.id, input: 'Hàn board ScanBox', startedAt: new Date('2026-08-19T00:00:00+07:00'), user: { id: phu.id } });
    const manager = {
      createQueryBuilder: jest.fn(() => ({ where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getCount: jest.fn(async () => 1) })),
      create: jest.fn((_entity: unknown, input: Record<string, unknown>) => ({ ...input })),
      save: jest.fn(async (input: Record<string, unknown> | Record<string, unknown>[]) => Array.isArray(input) ? input : ({ ...input, id: input.id ?? 'comment-id' })),
    };
    dataSource.transaction.mockImplementation(async (callback: (transactionManager: typeof manager) => Promise<unknown>) => callback(manager));
    dataSource.getRepository.mockReturnValue({ findOne: jest.fn(async () => ({ id: 'comment-id', worklogId: 'worklog-id', body: '@VINH kiểm tra giúp', author: phu, mentions: [] })) });

    const image = { mimetype: 'image/png', size: 3, buffer: Buffer.from('png') } as Express.Multer.File;
    await expect(service.comment('worklog-id', { body: '  @VINH kiểm tra giúp  ', mentionedUserIds: ['vinh-id'] }, phu, image)).resolves.toMatchObject({ id: 'comment-id' });
    expect(manager.create).toHaveBeenCalledWith(WorklogComment, expect.objectContaining({ imageMimeType: 'image/png', imageByteSize: 3, imageData: image.buffer }));
    expect(systemNotifications.create).toHaveBeenNthCalledWith(1, manager, expect.objectContaining({
      eventType: 'WORKLOG_MENTION', relatedUserIds: ['vinh-id'], includeAdmins: false,
    }));
    expect(systemNotifications.create).toHaveBeenNthCalledWith(2, manager, expect.objectContaining({
      eventType: 'WORKLOG_COMMENT', relatedUserIds: [], excludeUserIds: ['vinh-id'],
    }));
    expect(realtime.emitWorklog).toHaveBeenCalledWith('worklog.comment.created', expect.objectContaining({ id: 'comment-id' }));
  });

  it('rejects an empty Worklog comment without an image', async () => {
    worklogs.findOne.mockResolvedValue({ id: 'worklog-id', userId: phu.id, input: 'Hàn board ScanBox', startedAt: new Date('2026-08-19T00:00:00+07:00'), user: { id: phu.id } });
    await expect(service.comment('worklog-id', { body: '', mentionedUserIds: [] }, phu)).rejects.toThrow('Cần nhập comment hoặc đính kèm ảnh');
  });

  it('starts every linked Backlog Task while preserving other unfinished Task states', async () => {
    tasks.find.mockResolvedValueOnce([
      { id: '11111111-1111-4111-8111-111111111111', status: TaskStatus.BACKLOG },
      { id: '22222222-2222-4222-8222-222222222222', status: TaskStatus.DONE },
    ]);
    const saved = await service.create({
      ...basic,
      primaryTaskId: '11111111-1111-4111-8111-111111111111',
      taskIds: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
      input: 'Kiểm tra chung hai line',
      startedAt: '2026-08-19T08:30:00+07:00',
      status: WorklogStatus.OPEN,
    }, phu);
    expect(saved.tasks).toEqual([
      expect.objectContaining({ id: '11111111-1111-4111-8111-111111111111', status: TaskStatus.BACKLOG }),
      expect.objectContaining({ id: '22222222-2222-4222-8222-222222222222', status: TaskStatus.DONE }),
    ]);
    expect(taskLifecycle.startFromWorklog).toHaveBeenCalledWith([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ], phu, 'saved-worklog-id');
    expect(realtime.emitWorklog).toHaveBeenCalledWith('worklog.updated', expect.objectContaining({ status: WorklogStatus.OPEN }));
  });

  it('starts a Backlog Task when it is added while editing a Worklog', async () => {
    worklogs.findOneBy.mockResolvedValue({ id: 'open-id', userId: phu.id, status: WorklogStatus.OPEN, scoredAt: null, startedAt: new Date('2026-08-19T00:00:00+07:00') });
    tasks.find.mockResolvedValueOnce([{ id: sourceTaskId, status: TaskStatus.BACKLOG }]);
    await service.update('open-id', {
      ...basic, input: 'Bổ sung Task nguồn', startedAt: '2026-08-19T00:00:00+07:00', status: WorklogStatus.OPEN,
    }, phu);
    expect(taskLifecycle.startFromWorklog).toHaveBeenCalledWith([sourceTaskId], phu, 'open-id');
  });

  it('rejects a missing or COMPLETE Task source', async () => {
    await expect(service.create({ ...basic, primaryTaskId: undefined, taskIds: [], input: 'Không có nguồn', startedAt: '2026-08-19T08:30:00+07:00', status: WorklogStatus.OPEN }, phu)).rejects.toBeInstanceOf(BadRequestException);
    tasks.find.mockResolvedValueOnce([{ id: sourceTaskId, status: TaskStatus.COMPLETE }]);
    await expect(service.create({ ...basic, input: 'Nguồn đã Complete', startedAt: '2026-08-19T08:30:00+07:00', status: WorklogStatus.OPEN }, phu)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lets Admin create for any active member but ignores userId from a Member', async () => {
    const forGiang = await service.create({ ...basic, userId: 'giang-id', input: 'Đóng máy', startedAt: '2026-08-18T08:00:00+07:00', status: WorklogStatus.OPEN }, admin);
    expect(forGiang).toMatchObject({ userId: 'giang-id', createdById: 'admin-id' });
    const forged = await service.create({ ...basic, userId: 'giang-id', input: 'Hàn board', startedAt: '2026-08-19T08:00:00+07:00', status: WorklogStatus.OPEN }, phu);
    expect(forged).toMatchObject({ userId: 'phu-id', createdById: 'phu-id' });
  });

  it('saves expected OUT before finishing and closes unchecked OUT as missed without requiring actual text', async () => {
    const backlog = await service.create({ ...basic, input: 'Chuẩn bị hàn board', output: 'Đã soạn khay', links: ['https://drive.google.com/file/1'], startedAt: '2026-08-19T00:00:00+07:00', hoursWorked: 1, status: WorklogStatus.BACKLOG }, phu);
    expect(backlog).toMatchObject({ status: WorklogStatus.BACKLOG, output: null, outputCriteria: [openCriterion], links: ['https://drive.google.com/file/1'], hoursWorked: '1.00', resultModelVersion: 2 });
    await expect(service.create({ ...basic, input: 'Hàn board', startedAt: '2026-08-19T08:00:00+07:00', status: WorklogStatus.DONE }, phu)).rejects.toBeInstanceOf(BadRequestException);
    const finished = await service.create({ ...basic, input: 'Hàn board', startedAt: '2026-08-19T08:00:00+07:00', hoursWorked: 2, status: WorklogStatus.DONE }, phu);
    expect(finished.outputCriteria).toEqual([{ ...openCriterion, actual: null, achieved: false }]);
  });

  it('automatically grants 80 percent effort Point when a Worklog is DONE', async () => {
    const saved = await service.create({ ...basic, outputCriteria: [achievedCriterion], input: 'Hàn board', startedAt: '2026-08-19T08:30:00+07:00', hoursWorked: 2, status: WorklogStatus.DONE }, phu);
    expect(saved).toMatchObject({ status: WorklogStatus.DONE, valueRate: 50, standardHours: '2.00', completionRate: '1.00', stabilityRate: '0.80', point: 80, scoredAt: expect.any(Date) });
  });

  it('scores a partially achieved Worklog proportionally and still finishes it as DONE', async () => {
    const saved = await service.create({
      ...basic,
      valueLevel: WorklogValueLevel.DEV,
      outputCriteria: [
        { id: 'out-1', expected: 'Luồng chính chạy', actual: 'Đạt', achieved: true },
        { id: 'out-2', expected: 'Không treo khi back', actual: 'Đạt', achieved: true },
        { id: 'out-3', expected: 'Không lỗi khi mất kết nối', actual: 'Đạt', achieved: true },
        { id: 'out-4', expected: 'Test đủ thiết bị', actual: 'Còn thiếu', achieved: false },
        { id: 'out-5', expected: 'Có bằng chứng', actual: 'Chưa có', achieved: false },
      ],
      input: 'Hoàn thiện luồng KeyBOX',
      startedAt: '2026-08-19T08:30:00+07:00',
      hoursWorked: 4,
      status: WorklogStatus.DONE,
    }, phu);
    expect(saved).toMatchObject({ status: WorklogStatus.DONE, completionRate: '0.60', point: 192, resultModelVersion: 2 });
  });

  it('rejects non-half-hour increments for a new Worklog', async () => {
    await expect(service.create({
      ...basic,
      input: 'Hàn board',
      startedAt: '2026-08-19T08:30:00+07:00',
      hoursWorked: 0.25,
      status: WorklogStatus.OPEN,
    }, phu)).rejects.toThrow('Worklog mới ghi số H theo bước 0.5 giờ');
  });

  it('allows Member to report earlier days in the current Sprint but blocks old Sprints and future dates', async () => {
    await expect(service.create({ ...basic, input: 'Báo việc hôm qua', startedAt: '2026-08-18T00:00:00+07:00', status: WorklogStatus.OPEN }, phu)).resolves.toMatchObject({ userId: phu.id });
    await expect(service.create({ ...basic, input: 'Báo bù Sprint cũ', startedAt: '2026-07-20T00:00:00+07:00', status: WorklogStatus.OPEN }, phu)).rejects.toThrow('Sprint hiện tại');
    await expect(service.create({ ...basic, input: 'Ngày tương lai', startedAt: '2026-08-21T00:00:00+07:00', status: WorklogStatus.OPEN }, phu)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.create({ ...basic, userId: phu.id, input: 'Admin bổ sung', startedAt: '2026-08-21T00:00:00+07:00', status: WorklogStatus.OPEN }, admin)).resolves.toMatchObject({ userId: phu.id });
  });

  it('blocks Member changing the original Worklog date', async () => {
    worklogs.findOneBy.mockResolvedValue({ id: 'old-id', userId: phu.id, status: WorklogStatus.OPEN, scoredAt: null, startedAt: new Date('2026-08-18T00:00:00+07:00') });
    await expect(service.update('old-id', {
      ...basic, input: 'Đổi ngày', startedAt: '2026-08-19T00:00:00+07:00', status: WorklogStatus.OPEN,
    }, phu)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('records a zero-output V2 session as completed DONE with zero Point', async () => {
    worklogs.findOneBy.mockResolvedValue({
      id: 'ended-id', userId: phu.id, input: 'Hàn mạch khó', status: WorklogStatus.OPEN,
      startedAt: new Date('2026-08-18T08:00:00+07:00'), point: null,
    });
    const adminSaved = await service.update('ended-id', {
      ...basic, primaryTaskId: undefined, taskIds: [], outputCriteria: [{ ...openCriterion, actual: 'Chưa ổn định', achieved: false }], input: 'Hàn mạch khó', startedAt: '2026-08-18T00:00:00+07:00', hoursWorked: 8, status: WorklogStatus.ENDED,
    }, admin);
    expect(adminSaved).toMatchObject({ status: WorklogStatus.DONE, point: 0, completionRate: '0.00', tasks: [] });
    worklogs.findOneBy.mockResolvedValue({ id: 'ended-id', userId: phu.id, status: WorklogStatus.OPEN, startedAt: new Date('2026-08-18T08:00:00+07:00') });
    const saved = await service.update('ended-id', {
      ...basic, outputCriteria: [{ ...openCriterion, actual: 'Mạch chưa giao tiếp ổn định', achieved: false }], input: 'Hàn mạch khó', startedAt: '2026-08-18T00:00:00+07:00', hoursWorked: 8, status: WorklogStatus.ENDED,
    }, phu);
    expect(saved).toMatchObject({ status: WorklogStatus.DONE, hoursWorked: '8.00', point: 0 });
    await expect(service.update('ended-id', {
      ...basic, input: 'Người khác sửa', startedAt: '2026-08-18T08:00:00+07:00', status: WorklogStatus.OPEN,
    }, { id: 'vinh-id', username: 'vinh', displayName: 'VINH', role: UserRole.MEMBER })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows only Admin to assign Point to DONE output', async () => {
    const score = { valueLevel: WorklogValueLevel.DEV, standardHours: 3, completionRate: 1, stabilityConfirmed: false };
    await expect(service.score('done-id', score, phu)).rejects.toBeInstanceOf(ForbiddenException);
    worklogs.findOneBy.mockResolvedValue({ id: 'done-id', userId: 'thang-id', status: WorklogStatus.DONE, workType: WorklogType.NORMAL, reopenBaseCount: 0, point: null });
    const saved = await service.score('done-id', score, admin);
    expect(saved).toMatchObject({ point: 240, valueLevel: WorklogValueLevel.DEV, valueRate: 100, standardHours: '3.00', completionRate: '1.00', reopenCount: 0, stabilityRate: '0.80', stabilityStatus: WorklogStabilityStatus.PENDING, scoredById: admin.id });
  });

  it('records RE-OPEN H at zero Point and recalculates the original Worklog', async () => {
    const original = { id: 'original-id', userId: 'thang-id', status: WorklogStatus.DONE, workType: WorklogType.NORMAL, reopenBaseCount: 0, stabilityStatus: WorklogStabilityStatus.CONFIRMED, valueLevel: WorklogValueLevel.DEV, standardHours: '2.00', completionRate: '1.00', point: 200 };
    worklogs.findOneBy.mockResolvedValueOnce(original).mockResolvedValueOnce(original);
    worklogs.count.mockResolvedValueOnce(1);
    const saved = await service.create({ ...basic, outputCriteria: [achievedCriterion], workType: WorklogType.REOPEN, reopenedWorklogId: original.id, input: 'Sửa lỗi phát sinh lại', startedAt: '2026-08-19T08:30:00+07:00', hoursWorked: 2, status: WorklogStatus.DONE }, phu);
    expect(saved).toMatchObject({ workType: WorklogType.REOPEN, reopenedWorklogId: original.id, hoursWorked: '2.00', point: 0 });
    expect(worklogs.save).toHaveBeenCalledWith(expect.objectContaining({ id: original.id, reopenCount: 1, stabilityStatus: WorklogStabilityStatus.PENDING, stabilityRate: '0.80', point: 160 }));
  });

  it('lets only Admin release the retained 20 percent for a stable Worklog', async () => {
    const row = { id: 'done-id', userId: 'thang-id', status: WorklogStatus.DONE, workType: WorklogType.NORMAL, reopenBaseCount: 0, stabilityStatus: WorklogStabilityStatus.PENDING, valueLevel: WorklogValueLevel.DEV, standardHours: '3.00', completionRate: '1.00', point: 240, scoredAt: new Date(), primaryTaskId: sourceTaskId, primaryTask: { id: sourceTaskId, status: TaskStatus.COMPLETE } };
    await expect(service.confirmStability(row.id, phu)).rejects.toBeInstanceOf(ForbiddenException);
    worklogs.findOne.mockResolvedValue(row);
    const saved = await service.confirmStability(row.id, admin);
    expect(saved).toMatchObject({ point: 300, stabilityRate: '1.00', stabilityStatus: WorklogStabilityStatus.CONFIRMED });
  });

  it('blocks stability Point until the primary Task is Complete', async () => {
    worklogs.findOne.mockResolvedValue({ id: 'done-id', userId: phu.id, status: WorklogStatus.DONE, workType: WorklogType.NORMAL, reopenBaseCount: 0, stabilityStatus: WorklogStabilityStatus.PENDING, valueLevel: WorklogValueLevel.DEV, standardHours: '3.00', completionRate: '1.00', point: 240, scoredAt: new Date(), primaryTaskId: sourceTaskId, primaryTask: { id: sourceTaskId, status: TaskStatus.DONE } });
    await expect(service.confirmStability('done-id', admin)).rejects.toThrow('Task nguồn chính cần được Admin Complete');
  });

  it('lets the owner request Task Review only from a linked DONE Worklog', async () => {
    worklogs.findOne.mockResolvedValue({ id: 'done-id', userId: phu.id, status: WorklogStatus.DONE, startedAt: new Date('2026-08-19T00:00:00+07:00'), tasks: [{ id: sourceTaskId }] });
    await expect(service.requestTaskReview('done-id', sourceTaskId, phu)).resolves.toMatchObject({ status: TaskStatus.DONE });
    expect(taskLifecycle.requestReviewFromWorklog).toHaveBeenCalledWith(sourceTaskId, phu, 'done-id');

    worklogs.findOne.mockResolvedValue({ id: 'open-id', userId: phu.id, status: WorklogStatus.OPEN, startedAt: new Date('2026-08-19T00:00:00+07:00'), tasks: [{ id: sourceTaskId }] });
    await expect(service.requestTaskReview('open-id', sourceTaskId, phu)).rejects.toThrow('Chỉ Worklog DONE');
  });

  it('locks a scored DONE Worklog for Member but lets Admin correct and recalculate it', async () => {
    worklogs.findOneBy.mockResolvedValue({ id: 'done-id', userId: phu.id, status: WorklogStatus.DONE, point: 150, scoredAt: new Date(), startedAt: new Date('2026-08-18T00:00:00+07:00') });
    await expect(service.update('done-id', {
      ...basic, outputCriteria: [achievedCriterion], input: 'Sửa sau chấm', startedAt: '2026-08-18T00:00:00+07:00', hoursWorked: 2, status: WorklogStatus.DONE,
    }, phu)).rejects.toBeInstanceOf(BadRequestException);
    worklogs.findOneBy.mockResolvedValue({ id: 'done-id', userId: phu.id, status: WorklogStatus.DONE, workType: WorklogType.NORMAL, reopenBaseCount: 0, point: 150, scoredAt: new Date(), startedAt: new Date('2026-08-18T00:00:00+07:00') });
    await expect(service.update('done-id', {
      ...basic, outputCriteria: [achievedCriterion], input: 'Admin sửa H', startedAt: '2026-08-18T00:00:00+07:00', hoursWorked: 2, status: WorklogStatus.DONE,
    }, admin)).resolves.toMatchObject({ point: 80, standardHours: '2.00' });
  });

  it('lets Admin reassign an unscored Worklog but ignores member owner changes', async () => {
    worklogs.findOneBy.mockResolvedValue({ id: 'open-id', userId: phu.id, status: WorklogStatus.OPEN, scoredAt: null, startedAt: new Date('2026-08-18T00:00:00+07:00') });
    const reassigned = await service.update('open-id', {
      ...basic, userId: 'giang-id', input: 'Đóng máy', startedAt: '2026-08-18T00:00:00+07:00', status: WorklogStatus.OPEN,
    }, admin);
    expect(reassigned).toMatchObject({ userId: 'giang-id', input: 'Đóng máy' });

    worklogs.findOneBy.mockResolvedValue({ id: 'open-id', userId: phu.id, status: WorklogStatus.OPEN, scoredAt: null, startedAt: new Date('2026-08-18T00:00:00+07:00') });
    const memberSaved = await service.update('open-id', {
      ...basic, userId: 'giang-id', input: 'Hàn board', startedAt: '2026-08-18T00:00:00+07:00', status: WorklogStatus.OPEN,
    }, phu);
    expect(memberSaved).toMatchObject({ userId: phu.id, input: 'Hàn board' });
  });

  it('soft deletes only when the actor is Admin', async () => {
    await expect(service.remove('open-id', phu)).rejects.toBeInstanceOf(ForbiddenException);
    worklogs.findOneBy.mockResolvedValue({ id: 'open-id', userId: phu.id, deletedAt: null, deletedById: null });
    await expect(service.remove('open-id', admin)).resolves.toEqual({ id: 'open-id' });
    expect(worklogs.save).toHaveBeenCalledWith(expect.objectContaining({
      deletedById: admin.id,
      deletedAt: expect.any(Date),
    }));
    expect(realtime.emitWorklog).toHaveBeenCalledWith('worklog.updated', expect.objectContaining({ id: 'open-id' }));
  });
});
