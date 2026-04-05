import { UserRole } from '@prisma/client';

/**
 * Fine-grained permissions checked by RolesGuard.
 * Maps each role to what they may do in the API.
 */
export enum Permission {
  DashboardRead = 'dashboard:read',
  RecordsRead = 'records:read',
  RecordsCreate = 'records:create',
  RecordsUpdate = 'records:update',
  RecordsDelete = 'records:delete',
  UsersRead = 'users:read',
  UsersManage = 'users:manage',
}

const VIEWER: Permission[] = [Permission.DashboardRead];

const ANALYST: Permission[] = [
  Permission.DashboardRead,
  Permission.RecordsRead,
];

const ADMIN: Permission[] = [
  Permission.DashboardRead,
  Permission.RecordsRead,
  Permission.RecordsCreate,
  Permission.RecordsUpdate,
  Permission.RecordsDelete,
  Permission.UsersRead,
  Permission.UsersManage,
];

export const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  [UserRole.VIEWER]: new Set(VIEWER),
  [UserRole.ANALYST]: new Set(ANALYST),
  [UserRole.ADMIN]: new Set(ADMIN),
};

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}
