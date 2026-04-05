import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Parses and validates decimal amount strings for financial records. */
export function parseRecordAmount(raw: string): Prisma.Decimal {
  const s = raw.trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) {
    throw new BadRequestException({
      error: {
        code: 'INVALID_AMOUNT',
        message: 'Amount must be a decimal number, for example 123.45.',
      },
    });
  }
  return new Prisma.Decimal(s);
}
