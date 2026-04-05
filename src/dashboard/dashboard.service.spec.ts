import { EntryType, Prisma } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { TrendGranularity } from './dto/dashboard-query.dto';
import { PrismaService } from '../prisma/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    financialRecord: {
      groupBy: jest.Mock;
      findMany: jest.Mock;
    };
    $queryRaw: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      financialRecord: {
        groupBy: jest.fn(),
        findMany: jest.fn(),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    service = new DashboardService(prisma as unknown as PrismaService);
  });

  it('computes net from income and expense totals', async () => {
    prisma.financialRecord.groupBy
      .mockResolvedValueOnce([
        { type: EntryType.INCOME, _sum: { amount: new Prisma.Decimal('100') } },
        { type: EntryType.EXPENSE, _sum: { amount: new Prisma.Decimal('40') } },
      ])
      .mockResolvedValueOnce([]);
    prisma.financialRecord.findMany.mockResolvedValueOnce([]);

    const out = await service.getSummary({ trend: TrendGranularity.MONTH });

    expect(out.totals.totalIncome).toBe('100.0000');
    expect(out.totals.totalExpense).toBe('40.0000');
    expect(out.totals.netBalance).toBe('60.0000');
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });
});
