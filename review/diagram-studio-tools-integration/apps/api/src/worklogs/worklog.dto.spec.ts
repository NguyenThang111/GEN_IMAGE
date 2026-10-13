import 'reflect-metadata';
import { validate } from 'class-validator';
import { CreateWorklogCommentDto, SaveWorklogDto, ScoreWorklogDto, WorklogOutputCriterionDto } from './worklog.dto';
import { WorklogStatus, WorklogType, WorklogValueLevel } from './worklog.entity';

describe('Worklog DTO', () => {
  const taskIds = ['11111111-1111-4111-8111-111111111111'];
  const primaryTaskId = taskIds[0];
  const outputCriteria = [Object.assign(new WorklogOutputCriterionDto(), { id: 'out-1', expected: 'Board hoạt động', actual: 'Đã test', achieved: true })];
  it('accepts every Worklog form status', async () => {
    for (const status of Object.values(WorklogStatus)) {
      const dto = Object.assign(new SaveWorklogDto(), { primaryTaskId, taskIds, outputCriteria, input: 'Hàn board', startedAt: '2026-08-12T08:30:00+07:00', endedAt: '2026-08-12T12:00:00+07:00', hoursWorked: 3.5, valueLevel: WorklogValueLevel.BASIC, status });
      expect(await validate(dto)).toHaveLength(0);
    }
  });

  it('accepts V2 OUT criteria and validates their nested fields', async () => {
    const base = { primaryTaskId, taskIds, input: 'Hàn board', startedAt: '2026-08-12T08:30:00+07:00', valueLevel: WorklogValueLevel.BASIC, status: WorklogStatus.OPEN };
    expect(await validate(Object.assign(new SaveWorklogDto(), base, { outputCriteria }))).toHaveLength(0);
    expect((await validate(Object.assign(new SaveWorklogDto(), base, { outputCriteria: [Object.assign(new WorklogOutputCriterionDto(), { id: '', expected: '' })] }))).some((error) => error.property === 'outputCriteria')).toBe(true);
  });

  it('rejects an unknown status', async () => {
    const dto = Object.assign(new SaveWorklogDto(), { taskIds, input: 'Hàn board', startedAt: '2026-08-12T08:30:00+07:00', valueLevel: WorklogValueLevel.BASIC, status: 'FAILED' });
    expect((await validate(dto)).some((error) => error.property === 'status')).toBe(true);
  });

  it('accepts an empty Task source list for service-level Admin permission handling', async () => {
    const base = { input: 'Hàn board', startedAt: '2026-08-12T08:30:00+07:00', valueLevel: WorklogValueLevel.BASIC, status: WorklogStatus.OPEN };
    expect(await validate(Object.assign(new SaveWorklogDto(), base, { taskIds: [] }))).toHaveLength(0);
    expect((await validate(Object.assign(new SaveWorklogDto(), base))).some((error) => error.property === 'taskIds')).toBe(true);
    expect(await validate(Object.assign(new SaveWorklogDto(), base, { taskIds: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'] }))).toHaveLength(0);
    expect((await validate(Object.assign(new SaveWorklogDto(), base, { taskIds: ['11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111'] }))).some((error) => error.property === 'taskIds')).toBe(true);
  });

  it.each([WorklogValueLevel.BASIC, WorklogValueLevel.DEV, WorklogValueLevel.RND])('accepts Admin Value Level %s', async (valueLevel) => {
    expect(await validate(Object.assign(new ScoreWorklogDto(), { valueLevel, standardHours: 3, completionRate: 1, stabilityConfirmed: false }))).toHaveLength(0);
  });

  it('accepts RE-OPEN with an original Worklog id', async () => {
    const dto = Object.assign(new SaveWorklogDto(), { taskIds, input: 'Sửa lại output cũ', startedAt: '2026-08-12T08:30:00+07:00', valueLevel: WorklogValueLevel.DEV, workType: WorklogType.REOPEN, reopenedWorklogId: '22222222-2222-4222-8222-222222222222', status: WorklogStatus.OPEN });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts unique http links and rejects invalid Worklog links', async () => {
    const base = { taskIds, input: 'Hàn board', startedAt: '2026-08-12T08:30:00+07:00', valueLevel: WorklogValueLevel.BASIC, status: WorklogStatus.OPEN };
    expect(await validate(Object.assign(new SaveWorklogDto(), base, { links: ['https://drive.google.com/file/1', 'http://example.com/log'] }))).toHaveLength(0);
    expect((await validate(Object.assign(new SaveWorklogDto(), base, { links: ['drive.google.com/file/1'] }))).some((error) => error.property === 'links')).toBe(true);
    expect((await validate(Object.assign(new SaveWorklogDto(), base, { links: ['https://example.com', 'https://example.com'] }))).some((error) => error.property === 'links')).toBe(true);
  });

  it.each([
    { valueLevel: 'OTHER', standardHours: 3, completionRate: 1, stabilityConfirmed: false },
    { valueLevel: WorklogValueLevel.DEV, standardHours: 0, completionRate: 1, stabilityConfirmed: false },
    { valueLevel: WorklogValueLevel.DEV, standardHours: 3, completionRate: 0.5, stabilityConfirmed: false },
    { valueLevel: WorklogValueLevel.DEV, standardHours: 3, completionRate: 1, stabilityConfirmed: 'yes' },
  ])('rejects invalid score input %#', async (input) => {
    expect(await validate(Object.assign(new ScoreWorklogDto(), input))).not.toHaveLength(0);
  });

  it('accepts text or image-only comment payloads and rejects oversized comments', async () => {
    const valid = Object.assign(new CreateWorklogCommentDto(), { body: '@VINH kiểm tra giúp', mentionedUserIds: ['11111111-1111-4111-8111-111111111111'] });
    expect(await validate(valid)).toHaveLength(0);
    expect(await validate(Object.assign(new CreateWorklogCommentDto(), { body: '', mentionedUserIds: [] }))).toHaveLength(0);
    expect((await validate(Object.assign(new CreateWorklogCommentDto(), { body: 'a'.repeat(4001), mentionedUserIds: [] }))).some((error) => error.property === 'body')).toBe(true);
    expect((await validate(Object.assign(new CreateWorklogCommentDto(), { body: 'Tag', mentionedUserIds: ['bad-id'] }))).some((error) => error.property === 'mentionedUserIds')).toBe(true);
  });
});
