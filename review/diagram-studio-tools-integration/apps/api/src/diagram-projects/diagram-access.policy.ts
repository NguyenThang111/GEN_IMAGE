import { ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { UserRole } from '../users/user.entity';
import { isWorklogDev } from '../worklogs/worklog.policy';

export function requireDiagramEditor(actor: AuthUser) {
  if (actor.role !== UserRole.ADMIN && !isWorklogDev(actor.username)) {
    throw new ForbiddenException('Chỉ Admin hoặc Dev được chỉnh sửa Diagram Studio');
  }
}
