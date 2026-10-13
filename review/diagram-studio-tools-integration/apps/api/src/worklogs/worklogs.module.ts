import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksModule } from '../tasks/tasks.module';
import { SystemNotificationsModule } from '../notifications/system-notifications.module';
import { Task } from '../tasks/task.entity';
import { User } from '../users/user.entity';
import { Worklog } from './worklog.entity';
import { WorklogComment } from './worklog-comment.entity';
import { WorklogCommentMention } from './worklog-comment-mention.entity';
import { WorklogWeek } from './worklog-week.entity';
import { WorklogsController } from './worklogs.controller';
import { WorklogsService } from './worklogs.service';

@Module({
  imports: [TypeOrmModule.forFeature([Worklog, WorklogWeek, WorklogComment, WorklogCommentMention, User, Task]), TasksModule, SystemNotificationsModule],
  controllers: [WorklogsController],
  providers: [WorklogsService],
})
export class WorklogsModule {}
