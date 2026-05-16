import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { tenantStorage } from '../../../tenant/tenant-storage';

@Injectable()
export class BankingDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(companyId: string) {
    const tenantId = tenantStorage.getStore()?.tenantId;
    if (!tenantId) {
      return { totalBalance: 0, accountCount: 0, recentTransactions: [] };
    }

    const accounts = await this.prisma.bankAccount.findMany({
      where: { tenantId, companyId, isActive: true },
      include: { balances: { orderBy: { asOf: 'desc' }, take: 1 } },
    });

    let totalBalance = new Prisma.Decimal(0);
    for (const a of accounts) {
      if (a.balances[0]) {
        totalBalance = totalBalance.add(a.balances[0].amount);
      }
    }

    const recentTransactions = await this.prisma.bankTransaction.findMany({
      where: { tenantId, companyId },
      orderBy: { bookedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        amount: true,
        bookedAt: true,
        description: true,
        transactionType: true,
      },
    });

    const connections = await this.prisma.bankConnection.count({
      where: { tenantId, companyId },
    });

    const pendingRecon = await this.prisma.bankTransaction.count({
      where: {
        tenantId,
        companyId,
        matches: { none: { status: { in: ['CONFIRMED', 'POSTED'] } } },
      },
    });

    return {
      totalBalance: totalBalance.toNumber(),
      accountCount: accounts.length,
      connectionCount: connections,
      pendingReconciliationCount: pendingRecon,
      recentTransactions,
    };
  }
}
