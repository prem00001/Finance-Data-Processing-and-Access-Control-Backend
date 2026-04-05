import { Injectable } from '@nestjs/common';
import { EntryType, Prisma } from '@prisma/client';
import { DashboardQueryDto, TrendGranularity } from './dto/dashboard-query.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(query: DashboardQueryDto) {
    const from = query.from;
    const to = query.to;
    const recentLimit = Math.min(Math.max(query.recentLimit ?? 10, 1), 50);

    const dateFilter: Prisma.DateTimeFilter = {};
    if (from) dateFilter.gte = from;
    if (to) dateFilter.lte = to;

    const baseWhere: Prisma.FinancialRecordWhereInput = {
      deletedAt: null,
      ...(Object.keys(dateFilter).length ? { occurredAt: dateFilter } : {}),
    };

    const [totals, byCategory, recent] = await Promise.all([
      this.prisma.financialRecord.groupBy({
        by: ['type'],
        where: baseWhere,
        _sum: { amount: true },
      }),
      this.prisma.financialRecord.groupBy({
        by: ['category', 'type'],
        where: baseWhere,
        _sum: { amount: true },
        orderBy: { category: 'asc' },
      }),
      this.prisma.financialRecord.findMany({
        where: baseWhere,
        orderBy: { occurredAt: 'desc' },
        take: recentLimit,
        select: {
          id: true,
          amount: true,
          type: true,
          category: true,
          occurredAt: true,
          notes: true,
          userId: true,
          user: { select: { name: true, email: true } },
        },
      }),
    ]);

    const income =
      totals.find((t) => t.type === EntryType.INCOME)?._sum.amount ?? new Prisma.Decimal(0);
    const expense =
      totals.find((t) => t.type === EntryType.EXPENSE)?._sum.amount ?? new Prisma.Decimal(0);
    const net = income.minus(expense);

    const categoryMap = new Map<
      string,
      { category: string; income: string; expense: string; net: string }
    >();
    for (const row of byCategory) {
      const key = row.category;
      if (!categoryMap.has(key)) {
        categoryMap.set(key, {
          category: key,
          income: '0.0000',
          expense: '0.0000',
          net: '0.0000',
        });
      }
      const agg = categoryMap.get(key)!;
      const sum = row._sum.amount ?? new Prisma.Decimal(0);
      if (row.type === EntryType.INCOME) {
        agg.income = sum.toFixed(4);
      } else {
        agg.expense = sum.toFixed(4);
      }
    }
    for (const v of categoryMap.values()) {
      const inc = new Prisma.Decimal(v.income);
      const exp = new Prisma.Decimal(v.expense);
      v.net = inc.minus(exp).toFixed(4);
    }

    const trendGranularity = query.trend ?? TrendGranularity.MONTH;
    const trendRows =
      trendGranularity === TrendGranularity.WEEK
        ? await this.trendByWeek(from, to)
        : await this.trendByMonth(from, to);

    const trendBuckets = new Map<
      string,
      { periodStart: string; income: string; expense: string; net: string }
    >();
    for (const row of trendRows) {
      const key = row.bucket.toISOString();
      if (!trendBuckets.has(key)) {
        trendBuckets.set(key, {
          periodStart: key,
          income: '0.0000',
          expense: '0.0000',
          net: '0.0000',
        });
      }
      const b = trendBuckets.get(key)!;
      const val = row.total.toFixed(4);
      if (row.type === 'INCOME') b.income = val;
      else b.expense = val;
    }
    for (const b of trendBuckets.values()) {
      const inc = new Prisma.Decimal(b.income);
      const exp = new Prisma.Decimal(b.expense);
      b.net = inc.minus(exp).toFixed(4);
    }

    return {
      range: {
        from: from ?? null,
        to: to ?? null,
      },
      totals: {
        totalIncome: income.toFixed(4),
        totalExpense: expense.toFixed(4),
        netBalance: net.toFixed(4),
      },
      byCategory: Array.from(categoryMap.values()).sort((a, b) =>
        a.category.localeCompare(b.category),
      ),
      recentActivity: recent.map((r) => ({
        id: r.id,
        amount: r.amount.toFixed(4),
        type: r.type,
        category: r.category,
        occurredAt: r.occurredAt,
        notes: r.notes,
        owner: { id: r.userId, name: r.user.name, email: r.user.email },
      })),
      trends: {
        granularity: trendGranularity,
        buckets: Array.from(trendBuckets.values()),
      },
    };
  }

  private async trendByMonth(from?: Date, to?: Date) {
    if (from && to) {
      return this.prisma.$queryRaw<
        { bucket: Date; type: string; total: Prisma.Decimal }[]
      >`
        SELECT date_trunc('month', occurred_at) AS bucket,
               type::text,
               SUM(amount) AS total
        FROM financial_records
        WHERE deleted_at IS NULL
          AND occurred_at >= ${from}
          AND occurred_at <= ${to}
        GROUP BY 1, type
        ORDER BY 1 ASC
      `;
    }
    if (from) {
      return this.prisma.$queryRaw<
        { bucket: Date; type: string; total: Prisma.Decimal }[]
      >`
        SELECT date_trunc('month', occurred_at) AS bucket,
               type::text,
               SUM(amount) AS total
        FROM financial_records
        WHERE deleted_at IS NULL
          AND occurred_at >= ${from}
        GROUP BY 1, type
        ORDER BY 1 ASC
      `;
    }
    if (to) {
      return this.prisma.$queryRaw<
        { bucket: Date; type: string; total: Prisma.Decimal }[]
      >`
        SELECT date_trunc('month', occurred_at) AS bucket,
               type::text,
               SUM(amount) AS total
        FROM financial_records
        WHERE deleted_at IS NULL
          AND occurred_at <= ${to}
        GROUP BY 1, type
        ORDER BY 1 ASC
      `;
    }
    return this.prisma.$queryRaw<{ bucket: Date; type: string; total: Prisma.Decimal }[]>`
      SELECT date_trunc('month', occurred_at) AS bucket,
             type::text,
             SUM(amount) AS total
      FROM financial_records
      WHERE deleted_at IS NULL
      GROUP BY 1, type
      ORDER BY 1 ASC
    `;
  }

  private async trendByWeek(from?: Date, to?: Date) {
    if (from && to) {
      return this.prisma.$queryRaw<
        { bucket: Date; type: string; total: Prisma.Decimal }[]
      >`
        SELECT date_trunc('week', occurred_at) AS bucket,
               type::text,
               SUM(amount) AS total
        FROM financial_records
        WHERE deleted_at IS NULL
          AND occurred_at >= ${from}
          AND occurred_at <= ${to}
        GROUP BY 1, type
        ORDER BY 1 ASC
      `;
    }
    if (from) {
      return this.prisma.$queryRaw<
        { bucket: Date; type: string; total: Prisma.Decimal }[]
      >`
        SELECT date_trunc('week', occurred_at) AS bucket,
               type::text,
               SUM(amount) AS total
        FROM financial_records
        WHERE deleted_at IS NULL
          AND occurred_at >= ${from}
        GROUP BY 1, type
        ORDER BY 1 ASC
      `;
    }
    if (to) {
      return this.prisma.$queryRaw<
        { bucket: Date; type: string; total: Prisma.Decimal }[]
      >`
        SELECT date_trunc('week', occurred_at) AS bucket,
               type::text,
               SUM(amount) AS total
        FROM financial_records
        WHERE deleted_at IS NULL
          AND occurred_at <= ${to}
        GROUP BY 1, type
        ORDER BY 1 ASC
      `;
    }
    return this.prisma.$queryRaw<{ bucket: Date; type: string; total: Prisma.Decimal }[]>`
      SELECT date_trunc('week', occurred_at) AS bucket,
             type::text,
             SUM(amount) AS total
      FROM financial_records
      WHERE deleted_at IS NULL
      GROUP BY 1, type
      ORDER BY 1 ASC
    `;
  }
}
