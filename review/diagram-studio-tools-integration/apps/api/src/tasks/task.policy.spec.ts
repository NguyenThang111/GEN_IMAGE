import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../users/user.entity';
import { TaskStatus } from './task.entity';
import { assigneeShares, calculateBasePoint, canDoneTask, evaluateCompletion, personalTaskNotificationKind, requireAdmin, requireTaskCommentable, requireTaskEditable } from './task.policy';

describe('Task policy', () => {
  it('rejects Member from Admin commands', () => {
    expect(() => requireAdmin(UserRole.MEMBER)).toThrow(ForbiddenException);
    expect(() => requireAdmin(UserRole.ADMIN)).not.toThrow();
  });

  it('allows editing Backlog and active tasks', () => {
    expect(() => requireTaskEditable(TaskStatus.BACKLOG)).not.toThrow();
    expect(() => requireTaskEditable(TaskStatus.ACTIVE)).not.toThrow();
    expect(() => requireTaskEditable(TaskStatus.DONE)).not.toThrow();
    expect(() => requireTaskEditable(TaskStatus.COMPLETE)).toThrow(BadRequestException);
    expect(() => requireTaskEditable(TaskStatus.ARCHIVED)).toThrow(BadRequestException);
  });

  it('allows comments on Backlog and active tasks', () => {
    expect(() => requireTaskCommentable(TaskStatus.BACKLOG)).not.toThrow();
    expect(() => requireTaskCommentable(TaskStatus.ACTIVE)).not.toThrow();
    expect(() => requireTaskCommentable(TaskStatus.DONE)).not.toThrow();
    expect(() => requireTaskCommentable(TaskStatus.COMPLETE)).toThrow(BadRequestException);
    expect(() => requireTaskCommentable(TaskStatus.ARCHIVED)).toThrow(BadRequestException);
  });

  it('allows an Assignee or Admin to Done, but rejects an unrelated Member', () => {
    expect(canDoneTask(UserRole.MEMBER, true)).toBe(true);
    expect(canDoneTask(UserRole.MEMBER, false)).toBe(false);
    expect(canDoneTask(UserRole.ADMIN, false)).toBe(true);
  });

  it('marks only a direct assignment or mention as a personal notice', () => {
    expect(personalTaskNotificationKind({ notificationType: 'TASK_MENTION', recipientId: 'vinh' })).toBe('MENTION');
    expect(personalTaskNotificationKind({ notificationType: 'TASK_EVENT', recipientId: 'vinh', eventType: 'CREATED', payload: { assigneeIds: ['vinh'] } })).toBe('ASSIGNED');
    expect(personalTaskNotificationKind({ notificationType: 'TASK_EVENT', recipientId: 'vinh', eventType: 'EDITED', payload: { changes: { assigneeIds: { from: ['phu'], to: ['phu', 'vinh'] } } } })).toBe('ASSIGNED');
    expect(personalTaskNotificationKind({ notificationType: 'TASK_EVENT', recipientId: 'admin', eventType: 'CREATED', payload: { assigneeIds: ['vinh'] } })).toBeNull();
    expect(personalTaskNotificationKind({ notificationType: 'TASK_COMMENT', recipientId: 'admin' })).toBeNull();
  });

  it('maps the five task factors to an automatic base Point', () => {
    expect(calculateBasePoint({ outputScope: 0, complexity: 0, uncertainty: 0, risk: 0, verification: 0 })).toBe(50);
    expect(calculateBasePoint({ outputScope: 1, complexity: 1, uncertainty: 1, risk: 1, verification: 2 })).toBe(200);
    expect(calculateBasePoint({ outputScope: 2, complexity: 2, uncertainty: 2, risk: 2, verification: 2 })).toBe(500);
  });

  it('splits Point by assignee order without duplicating it', () => {
    expect(assigneeShares(1)).toEqual([100]);
    expect(assigneeShares(2)).toEqual([75, 25]);
    expect(assigneeShares(3)).toEqual([50, 30, 20]);
    expect(() => assigneeShares(4)).toThrow(BadRequestException);
  });

  it('keeps all score factors at 100% when Done on time with full quality', () => {
    expect(evaluateCompletion('100.00', '2026-07-21', new Date('2026-07-21T16:59:59.000Z'))).toMatchObject({ wasLate: false, dueRate: 1, qualityRate: 1, reliabilityRate: 1, rate: 1, earnedPoint: '100.00' });
  });

  it('combines Due, first-review Quality and Reliability into earned Point', () => {
    expect(evaluateCompletion('100.00', '2026-07-21', new Date('2026-07-22T08:00:00.000Z'), 0.75)).toMatchObject({ wasLate: true, lateDays: 1, dueRate: 0.8, qualityRate: 0.75, reliabilityRate: 0.8, rate: 0.78, earnedPoint: '78.00' });
  });

  it('keeps Reliability at 100% when a late task warned before due', () => {
    expect(evaluateCompletion('100.00', '2026-07-21', new Date('2026-07-22T08:00:00.000Z'), 1, new Date('2026-07-21T08:00:00.000Z'))).toMatchObject({ dueRate: 0.8, reliabilityRate: 1, rate: 0.92, earnedPoint: '92.00' });
  });
});
