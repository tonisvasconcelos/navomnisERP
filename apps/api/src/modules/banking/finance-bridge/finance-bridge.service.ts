import { Injectable, NotFoundException } from '@nestjs/common';
import { LedgerSide, ReconciliationMatchStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { tenantStorage } from '../../../tenant/tenant-storage';

@Injectable()
export class FinanceBridgeService {
  constructor(private readonly prisma: PrismaService) {}

  async postMatch(matchId: string, companyId: string, bankAccountCode = 'OF-DEFAULT') {
    const tenantId = tenantStorage.getStore()?.tenantId;
    if (!tenantId) {
      throw new NotFoundException('Tenant ausente.');
    }

    const match = await this.prisma.reconciliationMatch.findFirst({
      where: { id: matchId, tenantId, companyId },
      include: { bankTransaction: true },
    });
    if (!match) {
      throw new NotFoundException('Conciliação não encontrada.');
    }
    if (match.status === ReconciliationMatchStatus.POSTED) {
      return match;
    }

    const txn = match.bankTransaction;
    const side = Number(txn.amount) >= 0 ? LedgerSide.CREDIT : LedgerSide.DEBIT;

    const ledger = await this.prisma.bankLedgerEntry.create({
      data: {
        tenantId,
        companyId,
        bankAccountCode,
        postingDate: txn.bookedAt,
        documentType: 'BANK_TXN',
        documentId: txn.id,
        side,
        amount: Math.abs(Number(txn.amount)),
        reconciledAt: new Date(),
      },
    });

    return this.prisma.reconciliationMatch.update({
      where: { id: matchId },
      data: {
        status: ReconciliationMatchStatus.POSTED,
        postedAt: new Date(),
        targetId: match.targetId ?? ledger.id,
      },
    });
  }
}
