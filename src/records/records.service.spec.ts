import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EntryType, Prisma, UserRole } from '@prisma/client';
import { RecordsService } from './records.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RecordsService', () => {
  let service: RecordsService;
  let prisma: {
    financialRecord: {
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $queryRaw: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      financialRecord: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };

    service = new RecordsService(prisma as unknown as PrismaService);
  });

  describe('findMany', () => {
    it('returns empty page when full-text search matches nothing', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);

      const result = await service.findMany(
        { search: 'nonexistentphrase', page: 1, limit: 20 },
        'user-1',
        UserRole.ADMIN,
      );

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(prisma.financialRecord.findMany).not.toHaveBeenCalled();
    });

    it('applies id filter after FTS hits', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ id: 'rec-1' }]);
      prisma.financialRecord.findMany.mockResolvedValueOnce([
        {
          id: 'rec-1',
          userId: 'u1',
          amount: new Prisma.Decimal('10'),
          type: EntryType.EXPENSE,
          category: 'Food',
          occurredAt: new Date(),
          notes: 'weekly groceries',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      prisma.financialRecord.count.mockResolvedValueOnce(1);

      const result = await service.findMany(
        { search: 'groceries', page: 1, limit: 20 },
        'user-1',
        UserRole.ADMIN,
      );

      expect(prisma.financialRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['rec-1'] },
            deletedAt: null,
          }),
        }),
      );
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('throws when viewer accesses another users record', async () => {
      prisma.financialRecord.findFirst.mockResolvedValueOnce({
        id: 'r1',
        userId: 'other',
        amount: new Prisma.Decimal('1'),
        type: EntryType.INCOME,
        category: 'X',
        occurredAt: new Date(),
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(service.findOne('r1', 'me', UserRole.VIEWER)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws NotFound when missing', async () => {
      prisma.financialRecord.findFirst.mockResolvedValueOnce(null);

      await expect(service.findOne('missing', 'me', UserRole.ADMIN)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
