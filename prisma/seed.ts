import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const users: {
    email: string;
    name: string;
    role: UserRole;
    status: UserStatus;
    password: string;
  }[] = [
    {
      email: 'admin@zorvyn.com',
      name: 'Alex Admin (Zorvyn)',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      password: 'Cracked@993',
    },
    {
      email: 'analyst@zorvyn.com',
      name: 'Avery Analyst (Zorvyn)',
      role: UserRole.ANALYST,
      status: UserStatus.ACTIVE,
      password: 'Insight@993',
    },
    {
      email: 'viewer@zorvyn.com',
      name: 'Vivian Viewer (Zorvyn)',
      role: UserRole.VIEWER,
      status: UserStatus.ACTIVE,
      password: 'Observe@993',
    },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        passwordHash,
        name: u.name,
        role: u.role,
        status: u.status,
      },
      create: {
        email: u.email,
        name: u.name,
        passwordHash,
        role: u.role,
        status: u.status,
      },
    });
  }

  const admin = await prisma.user.findFirst({
    where: { email: 'admin@zorvyn.com' },
  });
  if (!admin) return;

  const existing = await prisma.financialRecord.count();
  if (existing > 0) {
    console.log('Seed skipped: financial records already exist.');
    return;
  }

  const now = new Date();

  const sample: {
    amount: string;
    type: 'INCOME' | 'EXPENSE';
    category: string;
    daysAgo: number;
    notes: string;
  }[] = [
    {
      amount: '5200.00',
      type: 'INCOME',
      category: 'Operating — Payroll deposit',
      daysAgo: 28,
      notes:
        'Zorvyn ops: monthly salary credit to main operating account; payroll run PR-2026-03.',
    },
    {
      amount: '850.00',
      type: 'INCOME',
      category: 'Accounts Receivable — Client A',
      daysAgo: 21,
      notes:
        'Zorvyn billing: invoice INV-ZRVN-1042 partial payment received via wire; treasury ref W-8821.',
    },
    {
      amount: '320.50',
      type: 'INCOME',
      category: 'Accounts Receivable — Client B',
      daysAgo: 14,
      notes:
        'Zorvyn project milestone; ACH trace ID ACH-7781; recorded by finance@zorvyn.com.',
    },
    {
      amount: '175.00',
      type: 'INCOME',
      category: 'Interest — Savings',
      daysAgo: 7,
      notes: 'Zorvyn treasury: quarterly interest accrual on business savings (account ****4412).',
    },
    {
      amount: '1180.00',
      type: 'EXPENSE',
      category: 'Operating — Rent',
      daysAgo: 25,
      notes: 'Zorvyn HQ lease payment; contract LC-ZRVN-2024-03; landlord portal confirmation RNT-991.',
    },
    {
      amount: '245.80',
      type: 'EXPENSE',
      category: 'Operating — Utilities',
      daysAgo: 18,
      notes: 'Zorvyn facilities: electric and water; utility account U-4492-ZRVN.',
    },
    {
      amount: '129.99',
      type: 'EXPENSE',
      category: 'Software subscriptions',
      daysAgo: 12,
      notes: 'Zorvyn stack renewal: analytics seats x5; vendor receipt SUB-7734.',
    },
    {
      amount: '67.40',
      type: 'EXPENSE',
      category: 'Meals & entertainment',
      daysAgo: 9,
      notes: 'Zorvyn client success lunch; receipt archived per expense policy EXP-2026-09.',
    },
    {
      amount: '2100.00',
      type: 'EXPENSE',
      category: 'Payroll — Contractor',
      daysAgo: 6,
      notes: 'Zorvyn external designer retainer; 1099-eligible; contractor id CTR-ZRVN-12.',
    },
    {
      amount: '54.00',
      type: 'EXPENSE',
      category: 'Bank fees',
      daysAgo: 3,
      notes: 'Zorvyn banking: wire and monthly service charges; stmt line BKFEE-033.',
    },
  ];

  for (const row of sample) {
    const d = new Date(now);
    d.setDate(d.getDate() - row.daysAgo);
    await prisma.financialRecord.create({
      data: {
        userId: admin.id,
        amount: row.amount,
        type: row.type,
        category: row.category,
        occurredAt: d,
        notes: row.notes,
      },
    });
  }

  console.log('Seed complete: Zorvyn demo users and ledger-style records created.');
  console.log('  admin@zorvyn.com     → Cracked@993');
  console.log('  analyst@zorvyn.com   → Insight@993');
  console.log('  viewer@zorvyn.com    → Observe@993');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
