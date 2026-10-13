import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/user.entity';
import { RealtimeGateway } from './realtime.gateway';
import { TaskAssignee } from './task-assignee.entity';
import { TaskEvent } from './task-event.entity';
import { TaskComment } from './task-comment.entity';
import { TaskCommentMention } from './task-comment-mention.entity';
import { Task } from './task.entity';
import { TaskCriterion } from './task-criterion.entity';
import { TaskDraft } from './task-draft.entity';
import { TaskNotification } from './task-notification.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { EmailModule } from '../email/email.module';
import { Worklog } from '../worklogs/worklog.entity';
import { UsersModule } from '../users/users.module';

@Module({ imports: [TypeOrmModule.forFeature([Task, TaskAssignee, TaskCriterion, TaskDraft, TaskEvent, TaskComment, TaskCommentMention, TaskNotification, User, Worklog]), AuthModule, EmailModule, UsersModule], controllers: [TasksController], providers: [TasksService, RealtimeGateway], exports: [TasksService, RealtimeGateway] })
export class TasksModule {}
