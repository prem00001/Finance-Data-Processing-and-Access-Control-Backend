import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntryType, Prisma, UserRole } from '@prisma/client';
import { CreateRecordDto } from './dto/create-record.dto';
import { QueryRecordsDto } from './dto/query-records.dto';
import { UpdateRecordDto } from './dto/update-record.dto';
import { parseRecordAmount } from './records-amount.util';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RecordsService {
  constructor(private prisma: PrismaService) {}

  private mapRecord(row: {
    id: string;
    userId: string;
    amount: Prisma.Decimal;
    type: EntryType;
    category: string;
    occurredAt: Date;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      userId: row.userId,
      amount: row.amount.toFixed(4),
      type: row.type,
      category: row.category,
      occurredAt: row.occurredAt,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findMany(query: QueryRecordsDto, requesterId: string, requesterRole: UserRole) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.FinancialRecordWhereInput = {
      deletedAt: null,
    };

    if (requesterRole !== UserRole.ADMIN && requesterRole !== UserRole.ANALYST) {
      where.userId = requesterId;
    }

    if (query.from || query.to) {
      where.occurredAt = {};
      if (query.from) where.occurredAt.gte = query.from;
      if (query.to) where.occurredAt.lte = query.to;
    }
    if (query.category) {
      where.category = { equals: query.category, mode: 'insensitive' };
    }
    if (query.type) {
      where.type = query.type;
    }

    const term = query.search?.trim();
    if (term) {
      const hits = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM financial_records
        WHERE deleted_at IS NULL
          AND to_tsvector('english', coalesce(notes, '')) @@ websearch_to_tsquery('english', ${term})
      `;
      const ids = hits.map((h) => h.id);
      if (ids.length === 0) {
        return {
          data: [],
          meta: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        };
      }
      where.id = { in: ids };
    }

    const [items, total] = await Promise.all([
      this.prisma.financialRecord.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.financialRecord.count({ where }),
    ]);

    return {
      data: items.map((r) => this.mapRecord(r)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async findOne(id: string, requesterId: string, requesterRole: UserRole) {
    const row = await this.prisma.financialRecord.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Financial record not found.' },
      });
    }
    if (
      requesterRole !== UserRole.ADMIN &&
      requesterRole !== UserRole.ANALYST &&
      row.userId !== requesterId
    ) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN',
          message: 'You can only access your own records.',
        },
      });
    }
    return this.mapRecord(row);
  }

  async create(dto: CreateRecordDto, requesterId: string, requesterRole: UserRole) {
    const amount = parseRecordAmount(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException({
        error: { code: 'INVALID_AMOUNT', message: 'Amount must be greater than zero.' },
      });
    }

    let userId = requesterId;
    if (dto.userId && dto.userId !== requesterId) {
      if (requesterRole !== UserRole.ADMIN) {
        throw new ForbiddenException({
          error: {
            code: 'FORBIDDEN',
            message: 'Only administrators may assign records to another user.',
          },
        });
      }
      userId = dto.userId;
    }

    const row = await this.prisma.financialRecord.create({
      data: {
        userId,
        amount,
        type: dto.type,
        category: dto.category.trim(),
        occurredAt: dto.occurredAt,
        notes: dto.notes?.trim() || null,
      },
    });
    return this.mapRecord(row);
  }

  async update(
    id: string,
    dto: UpdateRecordDto,
    requesterId: string,
    requesterRole: UserRole,
  ) {
    const existing = await this.prisma.financialRecord.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Financial record not found.' },
      });
    }
    if (requesterRole !== UserRole.ADMIN && existing.userId !== requesterId) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'You can only update your own records.' },
      });
    }

    const data: Prisma.FinancialRecordUpdateInput = {};
    if (dto.amount !== undefined) {
      const amount = parseRecordAmount(dto.amount);
      if (amount.lte(0)) {
        throw new BadRequestException({
          error: { code: 'INVALID_AMOUNT', message: 'Amount must be greater than zero.' },
        });
      }
      data.amount = amount;
    }
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.category !== undefined) data.category = dto.category.trim();
    if (dto.occurredAt !== undefined) data.occurredAt = dto.occurredAt;
    if (dto.notes !== undefined) data.notes = dto.notes.trim() || null;

    const row = await this.prisma.financialRecord.update({
      where: { id },
      data,
    });
    return this.mapRecord(row);
  }

  async remove(id: string, requesterId: string, requesterRole: UserRole) {
    const existing = await this.prisma.financialRecord.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Financial record not found.' },
      });
    }
    if (requesterRole !== UserRole.ADMIN && existing.userId !== requesterId) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'You can only delete your own records.' },
      });
    }

    await this.prisma.financialRecord.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { ok: true, id, message: 'Record archived successfully.' };
  }
}
