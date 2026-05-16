import { Injectable } from '@nestjs/common';
import { BankTransactionType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { tenantStorage } from '../../../tenant/tenant-storage';

@Injectable()
export class PixService {
  constructor(private readonly prisma: PrismaService) {}

  async listPix(companyId: string, endToEndId?: string) {
    const tenantId = tenantStorage.getStore()?.tenantId;
    if (!tenantId) {
      return [];
    }
    return this.prisma.bankTransaction.findMany({
      where: {
        tenantId,
        companyId,
        transactionType: BankTransactionType.PIX,
        ...(endToEndId ? { pixDetail: { endToEndId } } : {}),
      },
      include: { pixDetail: true, account: true },
      orderBy: { bookedAt: 'desc' },
      take: 100,
    });
  }
}
