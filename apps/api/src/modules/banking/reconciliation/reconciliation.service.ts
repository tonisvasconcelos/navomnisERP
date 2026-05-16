import { Injectable, NotFoundException } from '@nestjs/common';
import { ReconciliationMatchStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { tenantStorage } from '../../../tenant/tenant-storage';
import type { BankTxnForMatch, ReconciliationCandidate } from './reconciliation-matcher';
import { suggestMatches } from './reconciliation-matcher';
import { FinanceBridgeService } from '../finance-bridge/finance-bridge.service';

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeBridge: FinanceBridgeService,
  ) {}

  async suggest(companyId: string, bankTransactionId?: string) {
    const tenantId = this.requireTenant();
    const rule = await this.prisma.reconciliationRule.findFirst({
      where: { tenantId, companyId, isActive: true },
    });
    const amountTolerance = rule ? Number(rule.amountTolerance) : 0.01;
    const dayTolerance = rule?.dayTolerance ?? 3;

    const txns = await this.prisma.bankTransaction.findMany({
      where: {
        tenantId,
        companyId,
        ...(bankTransactionId ? { id: bankTransactionId } : {}),
      },
      include: { pixDetail: true, matches: { where: { status: { not: ReconciliationMatchStatus.REJECTED } } } },
      take: 50,
      orderBy: { bookedAt: 'desc' },
    });

    const candidates = await this.loadCandidates(tenantId, companyId);
    const suggestions: Array<{
      bankTransactionId: string;
      matches: ReturnType<typeof suggestMatches>;
    }> = [];

    for (const txn of txns) {
      if (txn.matches.length > 0) {
        continue;
      }
      const forMatch: BankTxnForMatch = {
        id: txn.id,
        amount: Number(txn.amount),
        bookedAt: txn.bookedAt,
        transactionType: txn.transactionType,
        documentNumber: txn.documentNumber,
        endToEndId: txn.pixDetail?.endToEndId,
      };
      const matches = suggestMatches(forMatch, candidates, { amountTolerance, dayTolerance });
      if (matches.length) {
        suggestions.push({ bankTransactionId: txn.id, matches });
      }
    }
    return suggestions;
  }

  async confirmMatch(matchId: string, companyId: string, userId: string) {
    const tenantId = this.requireTenant();
    const match = await this.prisma.reconciliationMatch.findFirst({
      where: { id: matchId, tenantId, companyId },
    });
    if (!match) {
      throw new NotFoundException('Sugestão não encontrada.');
    }
    await this.prisma.reconciliationMatch.update({
      where: { id: matchId },
      data: {
        status: ReconciliationMatchStatus.CONFIRMED,
        matchedById: userId,
      },
    });
    return this.financeBridge.postMatch(matchId, companyId);
  }

  async createSuggestion(
    companyId: string,
    bankTransactionId: string,
    targetType: string,
    targetId: string,
    confidence: number,
  ) {
    const tenantId = this.requireTenant();
    return this.prisma.reconciliationMatch.create({
      data: {
        tenantId,
        companyId,
        bankTransactionId,
        targetType,
        targetId,
        confidence,
        status: ReconciliationMatchStatus.SUGGESTED,
      },
    });
  }

  async persistSuggestions(companyId: string, bankTransactionId?: string) {
    const raw = await this.suggest(companyId, bankTransactionId);
    const created = [];
    for (const row of raw) {
      for (const m of row.matches) {
        const existing = await this.prisma.reconciliationMatch.findFirst({
          where: {
            bankTransactionId: row.bankTransactionId,
            targetType: m.targetType,
            targetId: m.targetId,
          },
        });
        if (!existing) {
          created.push(
            await this.createSuggestion(
              companyId,
              row.bankTransactionId,
              m.targetType,
              m.targetId,
              m.confidence,
            ),
          );
        }
      }
    }
    return created;
  }

  private async loadCandidates(
    tenantId: string,
    companyId: string,
  ): Promise<ReconciliationCandidate[]> {
    const out: ReconciliationCandidate[] = [];
    const customer = await this.prisma.customerLedgerEntry.findMany({
      where: { tenantId, companyId, isOpen: true },
      take: 100,
    });
    for (const e of customer) {
      out.push({
        targetType: 'CUSTOMER_LEDGER',
        targetId: e.id,
        amount: Number(e.openAmount),
        postingDate: e.dueDate ?? e.postingDate,
        documentNumber: e.documentId ?? undefined,
      });
    }
    const supplier = await this.prisma.supplierLedgerEntry.findMany({
      where: { tenantId, companyId, isOpen: true },
      take: 100,
    });
    for (const e of supplier) {
      out.push({
        targetType: 'SUPPLIER_LEDGER',
        targetId: e.id,
        amount: -Number(e.openAmount),
        postingDate: e.dueDate ?? e.postingDate,
        documentNumber: e.documentId ?? undefined,
      });
    }
    return out;
  }

  private requireTenant(): string {
    const tenantId = tenantStorage.getStore()?.tenantId;
    if (!tenantId) {
      throw new NotFoundException('Tenant ausente.');
    }
    return tenantId;
  }
}
