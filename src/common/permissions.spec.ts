import { UserRole } from '@prisma/client';
import { Permission, roleHasPermission } from './permissions';

describe('roleHasPermission', () => {
  it('viewer may only read dashboard', () => {
    expect(roleHasPermission(UserRole.VIEWER, Permission.DashboardRead)).toBe(true);
    expect(roleHasPermission(UserRole.VIEWER, Permission.RecordsRead)).toBe(false);
  });

  it('analyst may read dashboard and records', () => {
    expect(roleHasPermission(UserRole.ANALYST, Permission.RecordsRead)).toBe(true);
    expect(roleHasPermission(UserRole.ANALYST, Permission.RecordsCreate)).toBe(false);
  });

  it('admin has full record and user permissions', () => {
    expect(roleHasPermission(UserRole.ADMIN, Permission.RecordsDelete)).toBe(true);
    expect(roleHasPermission(UserRole.ADMIN, Permission.UsersManage)).toBe(true);
  });
});
