import { BullModule } from '@nestjs/bullmq';
import { Module, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import {
  BANK_CONSENT_QUEUE,
  BANK_RECONCILIATION_QUEUE,
  BANK_SYNC_QUEUE,
  OPEN_FINANCE_CLIENT,
} from './banking.constants';
import { BankingController } from './banking.controller';
import { BankingOAuthController } from './banking-oauth.controller';
import { BankingAccessLogService } from './banking-access-log.service';
import { OpenFinanceEnabledGuard } from './guards/open-finance-enabled.guard';
import { CredentialVaultService } from './vault/credential-vault.service';
import { SandboxOpenFinanceClient } from './open-finance/sandbox-open-finance.client';
import { OpenFinanceInstitutionsService } from './open-finance/open-finance-institutions.service';
import { BankConnectionsService } from './connections/bank-connections.service';
import { ConsentOAuthService } from './consent/consent-oauth.service';
import { ConsentExpiryProcessor } from './consent/consent-expiry.processor';
import { BankSyncService } from './sync/bank-sync.service';
import { BankSyncProcessor } from './sync/bank-sync.processor';
import { ReconciliationService } from './reconciliation/reconciliation.service';
import { FinanceBridgeService } from './finance-bridge/finance-bridge.service';
import { BankingDashboardService } from './dashboard/banking-dashboard.service';
import { PixService } from './pix/pix.service';

const isWorker = process.env.PROCESS_ROLE === 'worker';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue(
      { name: BANK_SYNC_QUEUE },
      { name: BANK_RECONCILIATION_QUEUE },
      { name: BANK_CONSENT_QUEUE },
    ),
  ],
  controllers: [BankingController, BankingOAuthController],
  providers: [
    OpenFinanceEnabledGuard,
    BankingAccessLogService,
    CredentialVaultService,
    { provide: OPEN_FINANCE_CLIENT, useClass: SandboxOpenFinanceClient },
    OpenFinanceInstitutionsService,
    BankConnectionsService,
    ConsentOAuthService,
    BankSyncService,
    ReconciliationService,
    FinanceBridgeService,
    BankingDashboardService,
    PixService,
    ...(isWorker ? [BankSyncProcessor, ConsentExpiryProcessor] : []),
  ],
  exports: [CredentialVaultService, BankSyncService],
})
export class BankingModule implements OnModuleInit {
  constructor(
    @InjectQueue(BANK_CONSENT_QUEUE) private readonly consentQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.PROCESS_ROLE !== 'worker') {
      return;
    }
    const repeatable = await this.consentQueue.getRepeatableJobs();
    if (!repeatable.some((j) => j.name === 'consent-expiry')) {
      await this.consentQueue.add(
        'consent-expiry',
        {},
        { repeat: { every: 60 * 60 * 1000 }, removeOnComplete: true },
      );
    }
  }
}
