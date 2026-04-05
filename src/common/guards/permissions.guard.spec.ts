import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, UserStatus } from '@prisma/client';
import { PermissionsGuard } from './permissions.guard';
import { Permission } from '../permissions';
import { PrismaService } from '../../prisma/prisma.service';

function mockContext(user?: { sub: string; email?: string; role?: UserRole }) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let prisma: { user: { findUnique: jest.Mock } };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    prisma = { user: { findUnique: jest.fn() } };
    guard = new PermissionsGuard(
      reflector as unknown as Reflector,
      prisma as unknown as PrismaService,
    );
  });

  it('allows when no permissions are required', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ok = await guard.canActivate(mockContext({ sub: '1' }));
    expect(ok).toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('allows when permission list is empty', async () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    const ok = await guard.canActivate(mockContext({ sub: '1' }));
    expect(ok).toBe(true);
  });

  it('denies when user is missing on request', async () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.DashboardRead]);
    await expect(guard.canActivate(mockContext(undefined))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('denies viewer creating records', async () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.RecordsCreate]);
    prisma.user.findUnique.mockResolvedValue({
      status: UserStatus.ACTIVE,
      role: UserRole.VIEWER,
    });
    await expect(
      guard.canActivate(mockContext({ sub: 'u1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows admin to create records', async () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.RecordsCreate]);
    prisma.user.findUnique.mockResolvedValue({
      status: UserStatus.ACTIVE,
      role: UserRole.ADMIN,
    });
    const ok = await guard.canActivate(mockContext({ sub: 'u1' }));
    expect(ok).toBe(true);
  });
});
