import { WorklogStabilityStatus, WorklogStatus, WorklogType, WorklogValueLevel } from './worklog.entity';
import { calculateWorklogCapitalPoint, calculateWorklogPoint, isMemberCreatableVietnamWorkDate, isWorklogDev, summarizeWorklogs, summarizeWorklogsByWeek, vietnamSprintStart, vietnamWorkDate, vietnamWeekStart, worklogSprintNumber, worklogStabilityRate } from './worklog.policy';

describe('Worklog policy', () => {
  it('allows only the three Dev pilot usernames', () => {
    expect(isWorklogDev('thang')).toBe(true);
    expect(isWorklogDev('VINH')).toBe(true);
    expect(isWorklogDev('phu')).toBe(true);
    expect(isWorklogDev('admin')).toBe(false);
    expect(isWorklogDev('giang')).toBe(false);
  });

  it('allows any past date but blocks future dates in Vietnam timezone', () => {
    const now = new Date('2026-08-12T18:00:00.000Z');
    expect(vietnamWorkDate('2026-08-12T17:30:00.000Z')).toBe('2026-08-13');
    expect(isMemberCreatableVietnamWorkDate('2026-08-13T00:00:00+07:00', now)).toBe(true);
    expect(isMemberCreatableVietnamWorkDate('2026-08-12T00:00:00+07:00', now)).toBe(true);
    expect(isMemberCreatableVietnamWorkDate('2026-07-01T00:00:00+07:00', now)).toBe(true);
    expect(isMemberCreatableVietnamWorkDate('2026-08-14T00:00:00+07:00', now)).toBe(false);
  });

  it('groups Worklogs into fixed 14-day Sprints from 17 August 2026', () => {
    expect(vietnamSprintStart('2026-08-17T08:00:00+07:00')).toBe('2026-08-17');
    expect(vietnamSprintStart('2026-08-30T23:00:00+07:00')).toBe('2026-08-17');
    expect(vietnamSprintStart('2026-08-31T08:00:00+07:00')).toBe('2026-08-31');
    expect(worklogSprintNumber('2026-08-17')).toBe(1);
    expect(worklogSprintNumber('2026-08-31')).toBe(2);
  });

  it('totals Thang output Point and Phu ended H independently from Task', () => {
    const summary = summarizeWorklogs([
      { userId: 'thang-id', status: WorklogStatus.DONE, hoursWorked: '3.50', point: 150, workType: WorklogType.NORMAL, stabilityStatus: WorklogStabilityStatus.CONFIRMED },
      { userId: 'phu-id', status: WorklogStatus.ENDED, hoursWorked: '8.00', point: 0, valueLevel: WorklogValueLevel.DEV },
    ], [
      { id: 'thang-id', username: 'thang', displayName: 'THẮNG' },
      { id: 'phu-id', username: 'phu', displayName: 'PHÚ' },
    ]);
    expect(summary.find((row) => row.username === 'thang')).toMatchObject({ hours: 3.5, point: 150, confirmedPoint: 150, provisionalPoint: 0, done: 1, ended: 0 });
    expect(summary.find((row) => row.username === 'phu')).toMatchObject({ hours: 8, point: 0, capitalPoint: 200, conversionPercent: 0, done: 0, ended: 1 });
  });

  it('keeps DONE without Admin Point in the pending queue', () => {
    const [summary] = summarizeWorklogs([
      { userId: 'vinh-id', status: WorklogStatus.DONE, hoursWorked: '2.00', point: null },
    ], [{ id: 'vinh-id', username: 'vinh', displayName: 'VINH' }]);
    expect(summary).toMatchObject({ hours: 2, point: 0, done: 1, pendingPoint: 1 });
  });

  it('calculates effort Point and retains 20 percent for stability', () => {
    expect(calculateWorklogPoint(WorklogValueLevel.BASIC, 3, 1, 0)).toBe(120);
    expect(calculateWorklogPoint(WorklogValueLevel.BASIC, 3, 1, 0, true)).toBe(150);
    expect(calculateWorklogPoint(WorklogValueLevel.DEV, 3, 1, 1)).toBe(240);
    expect(calculateWorklogPoint(WorklogValueLevel.RND, 4, 0.6, 2)).toBe(576);
    expect(worklogStabilityRate(0)).toBe(0.8);
    expect(worklogStabilityRate(0, true)).toBe(1);
    expect(worklogStabilityRate(1)).toBe(0.8);
    expect(worklogStabilityRate(2)).toBe(0.8);
  });

  it('keeps DEV and R&D incomplete labor as capital but gives BASIC no capital', () => {
    expect(calculateWorklogCapitalPoint(WorklogValueLevel.BASIC, 8)).toBe(0);
    expect(calculateWorklogCapitalPoint(WorklogValueLevel.DEV, 8)).toBe(200);
    expect(calculateWorklogCapitalPoint(WorklogValueLevel.RND, 2)).toBe(300);
    expect(calculateWorklogCapitalPoint(WorklogValueLevel.RND, 8)).toBe(1200);
  });

  it('reports weekly capacity, conversion and capital from Monday to Sunday', () => {
    expect(vietnamWeekStart('2026-08-19T02:00:00+07:00')).toBe('2026-08-17');
    const [week] = summarizeWorklogsByWeek([
      { userId: 'phu-id', startedAt: '2026-08-17T08:00:00+07:00', status: WorklogStatus.DONE, hoursWorked: '40.00', standardHours: '40.00', completionRate: '1.00', point: 3200, valueLevel: WorklogValueLevel.DEV, workType: WorklogType.NORMAL, stabilityStatus: WorklogStabilityStatus.PENDING },
      { userId: 'phu-id', startedAt: '2026-08-21T08:00:00+07:00', status: WorklogStatus.ENDED, hoursWorked: '5.00', point: 0, valueLevel: WorklogValueLevel.DEV },
    ], [{ id: 'phu-id', username: 'phu', displayName: 'PHÚ' }]);
    expect(week).toMatchObject({ weekStart: '2026-08-17', weekEnd: '2026-08-23' });
    expect(week.summary[0]).toMatchObject({ hours: 45, point: 3200, capitalPoint: 125, conversionPercent: 88.9 });
  });

  it('reports weekly Value mix, Task discipline, Re-open and V2 coverage', () => {
    const [summary] = summarizeWorklogs([
      { userId: 'vinh-id', status: WorklogStatus.DONE, hoursWorked: '2.00', point: 80, valueLevel: WorklogValueLevel.BASIC, workType: WorklogType.NORMAL, primaryTaskId: 'task-1', resultModelVersion: 2 },
      { userId: 'vinh-id', status: WorklogStatus.DONE, hoursWorked: '1.00', point: 0, valueLevel: WorklogValueLevel.DEV, workType: WorklogType.REOPEN, primaryTaskId: null, resultModelVersion: 1 },
      { userId: 'vinh-id', status: WorklogStatus.OPEN, hoursWorked: null, point: null, valueLevel: WorklogValueLevel.RND, workType: WorklogType.NORMAL, primaryTaskId: 'task-2', resultModelVersion: 2 },
    ], [{ id: 'vinh-id', username: 'vinh', displayName: 'VINH' }]);
    expect(summary).toMatchObject({ worklogs: 3, basicWorklogs: 1, devWorklogs: 1, rndWorklogs: 1, reopenWorklogs: 1, linkedWorklogs: 2, v2Worklogs: 2 });
  });

  it('retains stability Point only from achieved V2 Outputs', () => {
    const [summary] = summarizeWorklogs([
      { userId: 'phu-id', status: WorklogStatus.DONE, hoursWorked: '4.00', standardHours: '4.00', completionRate: '0.60', point: 192, valueLevel: WorklogValueLevel.DEV, workType: WorklogType.NORMAL, stabilityStatus: WorklogStabilityStatus.PENDING, reopenCount: 0, resultModelVersion: 2 },
    ], [{ id: 'phu-id', username: 'phu', displayName: 'PHÚ' }]);
    expect(summary).toMatchObject({ productiveBasePoint: 240, point: 192, pendingStabilityPoint: 48 });
  });
});
