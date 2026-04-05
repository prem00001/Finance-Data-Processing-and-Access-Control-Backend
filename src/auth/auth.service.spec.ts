import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock } };
  let jwt: { signAsync: jest.Mock };

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };
    service = new AuthService(prisma as unknown as PrismaService, jwt as unknown as JwtService);
  });

  it('rejects unknown email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login('unknown@zorvyn.com', 'Cracked@993')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects inactive users', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: '1',
      email: 'viewer@zorvyn.com',
      passwordHash: 'hash',
      name: 'N',
      role: UserRole.VIEWER,
      status: UserStatus.INACTIVE,
    });
    await expect(service.login('viewer@zorvyn.com', 'Observe@993')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns token when password matches', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: '1',
      email: 'admin@zorvyn.com',
      passwordHash: 'hash',
      name: 'N',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const out = await service.login('admin@zorvyn.com', 'Cracked@993');
    expect(out.access_token).toBe('signed.jwt.token');
    expect(out.user.role).toBe(UserRole.ADMIN);
    expect(jwt.signAsync).toHaveBeenCalled();
  });
});
