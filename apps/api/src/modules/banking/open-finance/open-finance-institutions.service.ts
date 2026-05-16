import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { BankingAccessLogService } from '../banking-access-log.service';
import { BankingAccessAction } from '@prisma/client';

@Injectable()
export class OpenFinanceInstitutionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessLog: BankingAccessLogService,
  ) {}

  async listActive() {
    await this.accessLog.log(BankingAccessAction.READ_ACCOUNTS, { resource: 'institutions' });
    return this.prisma.financialInstitution.findMany({
      where: { isActive: true, isSandbox: true },
      orderBy: { brandName: 'asc' },
      select: {
        id: true,
        participantId: true,
        brandName: true,
        ispb: true,
        compe: true,
        isSandbox: true,
      },
    });
  }
}
