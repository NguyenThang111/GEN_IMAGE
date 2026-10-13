import { UserRole } from '../users/user.entity';
export type AuthUser = { id: string; username: string; displayName: string; role: UserRole };
