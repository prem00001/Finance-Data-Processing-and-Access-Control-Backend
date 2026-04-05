import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  it('findOne throws when missing', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.findOne('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create propagates unique constraint as ConflictException', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    const err = new Prisma.PrismaClientKnownRequestError('Unique', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['email'] },
    });
    prisma.user.create.mockRejectedValue(err);
    await expect(
      service.create({
        email: 'dup@zorvyn.com',
        password: 'Welcome@993',
        name: 'D',
        role: UserRole.VIEWER,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
