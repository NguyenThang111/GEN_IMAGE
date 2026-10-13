import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { User } from '../users/user.entity';
import { TaskDraft } from './task-draft.entity';
import { TasksService } from './tasks.service';

async function smoke() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const drafts = app.get<Repository<TaskDraft>>(getRepositoryToken(TaskDraft));
  const users = app.get<Repository<User>>(getRepositoryToken(User));
  const tasks = app.get(TasksService);
  const dataSource = app.get(DataSource);
  let draftId: string | null = null;
  let taskId: string | null = null;
  try {
    const [admin, phu, vinh] = await Promise.all([users.findOneBy({ username: 'admin' }), users.findOneBy({ username: 'phu' }), users.findOneBy({ username: 'vinh' })]);
    if (!admin || !phu || !vinh) throw new Error('Admin, PHÚ and VINH accounts are required');
    const draft = await drafts.save(drafts.create({
      topic: 'SMOKE · CLAIM', description: 'Draft tạm để kiểm luồng nhận việc.', assigneeIds: [phu.id],
      criteria: ['Task ACTIVE giữ đúng Acceptance.'],
      pointFactors: { outputScope: 1, complexity: 1, uncertainty: 1, risk: 1, verification: 1 },
      dueDate: null, sourceStatus: 'SMOKE', sourcePriority: null,
      importKey: `smoke-week1-${Date.now()}`, createdById: admin.id, deletedById: null, deletedAt: null,
    }));
    draftId = draft.id;
    let wrongAssigneeRejected = false;
    try {
      await tasks.claimDraft(draft.id, { id: vinh.id, username: vinh.username, displayName: vinh.displayName, role: vinh.role });
    } catch { wrongAssigneeRejected = true; }
    if (!wrongAssigneeRejected) throw new Error('A different Dev could claim an assigned draft');
    const claimed = await tasks.claimDraft(draft.id, { id: phu.id, username: phu.username, displayName: phu.displayName, role: phu.role });
    taskId = claimed.id;
    if (claimed.status !== 'ACTIVE' || claimed.dueDate !== '2026-08-09') throw new Error('Claim did not create the expected ACTIVE task');
    if (claimed.criteria.length !== 1 || Number(claimed.point) !== 200) throw new Error('Claim did not preserve Acceptance or Point');
    const hiddenDraft = await drafts.findOneBy({ id: draft.id });
    if (!hiddenDraft?.deletedAt) throw new Error('Claim did not soft-delete the draft');
    let duplicateClaimRejected = false;
    try {
      await tasks.claimDraft(draft.id, { id: phu.id, username: phu.username, displayName: phu.displayName, role: phu.role });
    } catch { duplicateClaimRejected = true; }
    if (!duplicateClaimRejected) throw new Error('The same draft could be claimed twice');
    process.stdout.write('Week 1 claim smoke passed: permission, duplicate guard, ACTIVE, Due, Acceptance, Point and soft-delete verified\n');
  } finally {
    if (taskId) {
      await dataSource.query('DELETE FROM email_outbox WHERE "dedupeKey" LIKE $1', [`%:${taskId}:%`]);
      await dataSource.query('DELETE FROM task_events WHERE "taskId" = $1', [taskId]);
      await dataSource.query('DELETE FROM tasks WHERE id = $1', [taskId]);
    }
    if (draftId) await dataSource.query('DELETE FROM task_drafts WHERE id = $1', [draftId]);
    await app.close();
  }
}

void smoke();
