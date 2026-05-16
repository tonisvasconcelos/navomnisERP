import { Injectable } from '@nestjs/common';
import { BankingAccessAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { tenantStorage } from '../../tenant/tenant-storage';

@Injectable()
export class BankingAccessLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    action: BankingAccessAction,
    opts?: { companyId?: string; resource?: string; ip?: string; metadata?: object },
  ): Promise<void> {
    const ctx = tenantStorage.getStore();
    if (!ctx?.tenantId || !ctx.userId) {
      return;
    }
    await this.prisma.bankingAccessLog.create({
      data: {
        tenantId: ctx.tenantId,
        companyId: opts?.companyId,
        userId: ctx.userId,
        action,
        resource: opts?.resource,
        ip: opts?.ip,
        metadata: opts?.metadata,
      },
    });
  }
}
