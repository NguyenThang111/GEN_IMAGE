import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull, Like, Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { User } from '../users/user.entity';
import { TaskDraft } from './task-draft.entity';
import { TasksService } from './tasks.service';


async function promote() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const drafts = app.get<Repository<TaskDraft>>(getRepositoryToken(TaskDraft));
    const users = app.get<Repository<User>>(getRepositoryToken(User));
    const tasks = app.get(TasksService);
    const visible = await drafts.find({ where: { importKey: Like('workplace-week1-2026-08:%'), deletedAt: IsNull() }, order: { createdAt: 'ASC' } });
    const people = await users.find();
    const byId = new Map(people.map((user) => [user.id, user]));
    let promoted = 0;
    for (const draft of visible) {
      const owner = byId.get(draft.assigneeIds[0]);
      if (!owner || !['thang', 'vinh', 'phu'].includes(owner.username)) throw new Error(`Draft ${draft.id} has no valid Workplace Dev`);
      await tasks.claimDraft(draft.id, { id: owner.id, username: owner.username, displayName: owner.displayName, role: owner.role });
      promoted += 1;
    }
    process.stdout.write(`Week 1 pool: ${promoted} task(s) moved from Backlog to Task\n`);
  } finally {
    await app.close();
  }
}

void promote();
