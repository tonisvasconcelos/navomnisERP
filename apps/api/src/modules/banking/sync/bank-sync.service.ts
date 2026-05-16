import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  BankAccountType,
  BankConnectionStatus,
  BankConsentStatus,
  BankSyncJobStatus,
  BankSyncJobType,
  BankTransactionType,
  BankingAccessAction,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { tenantStorage } from '../../../tenant/tenant-storage';
import { OPEN_FINANCE_CLIENT } from '../banking.constants';
import { BankingAccessLogService } from '../banking-access-log.service';
import { CredentialVaultService } from '../vault/credential-vault.service';
import type { OpenFinanceClient } from '../open-finance/open-finance-client.interface';

@Injectable()
export class BankSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: CredentialVaultService,
    private readonly accessLog: BankingAccessLogService,
    @Inject(OPEN_FINANCE_CLIENT) private readonly ofClient: OpenFinanceClient,
  ) {}

  async listAccounts(companyId: string) {
    const tenantId = this.requireTenant();
    await this.accessLog.log(BankingAccessAction.READ_ACCOUNTS, { companyId });
    return this.prisma.bankAccount.findMany({
      where: { tenantId, companyId, isActive: true },
      include: {
        connection: { include: { institution: { select: { brandName: true } } } },
        balances: { orderBy: { asOf: 'desc' }, take: 1 },
      },
    });
  }

  async listTransactions(
    companyId: string,
    filters: {
      accountId?: string;
      from?: string;
      to?: string;
      transactionType?: string;
      endToEndId?: string;
    },
  ) {
    const tenantId = this.requireTenant();
    await this.accessLog.log(BankingAccessAction.READ_TRANSACTIONS, { companyId });
    const where: Prisma.BankTransactionWhereInput = { tenantId, companyId };
    if (filters.accountId) {
      where.accountId = filters.accountId;
    }
    if (filters.from || filters.to) {
      where.bookedAt = {};
      if (filters.from) {
        where.bookedAt.gte = new Date(filters.from);
      }
      if (filters.to) {
        where.bookedAt.lte = new Date(filters.to);
      }
    }
    if (filters.transactionType) {
      where.transactionType = filters.transactionType as BankTransactionType;
    }
    if (filters.endToEndId) {
      where.pixDetail = { endToEndId: filters.endToEndId };
    }
    return this.prisma.bankTransaction.findMany({
      where,
      include: { pixDetail: true, account: { select: { displayName: true, accountNumber: true } } },
      orderBy: { bookedAt: 'desc' },
      take: 200,
    });
  }

  async enqueueAccountSync(connectionId: string, consentId?: string, tenantIdOverride?: string) {
    const tenantId =
      tenantIdOverride ?? tenantStorage.getStore()?.tenantId ?? (await this.tenantForConnection(connectionId));
    if (!tenantId) {
      throw new NotFoundException('Tenant ausente para enfileirar sincronização.');
    }
    const job = await this.prisma.bankSyncJob.create({
      data: {
        tenantId,
        connectionId,
        consentId,
        jobType: BankSyncJobType.ACCOUNTS,
        status: BankSyncJobStatus.PENDING,
      },
    });
    return { jobId: job.id };
  }

  async runSyncJob(jobId: string): Promise<void> {
    const job = await this.prisma.bankSyncJob.findUnique({
      where: { id: jobId },
      include: {
        connection: {
          include: {
            institution: true,
            consents: {
              where: { status: BankConsentStatus.AUTHORISED },
              include: { credential: true },
              orderBy: { authorisedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
    if (!job || job.connection.status !== BankConnectionStatus.ACTIVE) {
      return;
    }

    await this.prisma.bankSyncJob.update({
      where: { id: jobId },
      data: { status: BankSyncJobStatus.RUNNING, startedAt: new Date() },
    });

    try {
      const consent = job.connection.consents[0];
      if (!consent?.credential) {
        throw new Error('Consentimento ativo não encontrado.');
      }
      const accessToken = this.vault.decryptAccessToken(
        consent.credential.accessCipher,
        consent.credential.accessIv,
        consent.credential.keyVersion,
      );
      const participantId = job.connection.institution.participantId;

      if (job.jobType === BankSyncJobType.ACCOUNTS || job.jobType === BankSyncJobType.BALANCES) {
        await this.syncAccounts(job, accessToken, participantId);
      }
      if (
        job.jobType === BankSyncJobType.TRANSACTIONS_HISTORICAL ||
        job.jobType === BankSyncJobType.TRANSACTIONS_INCREMENTAL
      ) {
        await this.syncTransactions(
          jobId,
          job,
          accessToken,
          participantId,
          job.cursor ?? undefined,
        );
      }

      await this.prisma.bankSyncJob.update({
        where: { id: jobId },
        data: { status: BankSyncJobStatus.COMPLETED, finishedAt: new Date() },
      });
      await this.prisma.bankConnection.update({
        where: { id: job.connectionId },
        data: { lastSyncAt: new Date(), lastError: null },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro de sincronização';
      await this.prisma.bankSyncJob.update({
        where: { id: jobId },
        data: {
          status: BankSyncJobStatus.FAILED,
          finishedAt: new Date(),
          errorMessage: message,
        },
      });
      await this.prisma.bankConnection.update({
        where: { id: job.connectionId },
        data: { lastError: message },
      });
    }
  }

  private async syncAccounts(
    job: { tenantId: string; connection: { id: string; companyId: string; institution: { participantId: string } } },
    accessToken: string,
    participantId: string,
  ) {
    const accounts = await this.ofClient.listAccounts(accessToken, participantId);
    for (const acc of accounts) {
      const account = await this.prisma.bankAccount.upsert({
        where: {
          tenantId_connectionId_externalId: {
            tenantId: job.tenantId,
            connectionId: job.connection.id,
            externalId: acc.externalId,
          },
        },
        create: {
          tenantId: job.tenantId,
          companyId: job.connection.companyId,
          connectionId: job.connection.id,
          externalId: acc.externalId,
          accountType: (acc.accountType as BankAccountType) || BankAccountType.CHECKING,
          branchNumber: acc.branchNumber,
          accountNumber: acc.accountNumber,
          checkDigit: acc.checkDigit,
          currency: acc.currency,
          displayName: acc.displayName,
          lastSyncAt: new Date(),
        },
        update: { lastSyncAt: new Date(), displayName: acc.displayName },
      });

      const balance = await this.ofClient.getBalance(accessToken, participantId, acc.externalId);
      await this.prisma.bankBalance.create({
        data: {
          tenantId: job.tenantId,
          companyId: job.connection.companyId,
          accountId: account.id,
          amount: balance.amount,
          asOf: balance.asOf,
        },
      });
    }
  }

  private async syncTransactions(
    jobId: string,
    job: {
      tenantId: string;
      connection: { id: string; companyId: string; institution: { participantId: string } };
    },
    accessToken: string,
    participantId: string,
    cursor?: string,
  ) {
    const accounts = await this.prisma.bankAccount.findMany({
      where: { tenantId: job.tenantId, connectionId: job.connection.id },
    });
    for (const account of accounts) {
      const page = await this.ofClient.listTransactions(
        accessToken,
        participantId,
        account.externalId,
        undefined,
        cursor,
      );
      for (const tx of page.items) {
        const txn = await this.prisma.bankTransaction.upsert({
          where: {
            tenantId_accountId_externalId: {
              tenantId: job.tenantId,
              accountId: account.id,
              externalId: tx.externalId,
            },
          },
          create: {
            tenantId: job.tenantId,
            companyId: job.connection.companyId,
            accountId: account.id,
            externalId: tx.externalId,
            transactionType: (tx.transactionType as BankTransactionType) || BankTransactionType.OTHER,
            amount: tx.amount,
            bookedAt: tx.bookedAt,
            description: tx.description,
            documentNumber: tx.documentNumber,
          },
          update: {
            amount: tx.amount,
            description: tx.description,
            documentNumber: tx.documentNumber,
          },
        });
        if (tx.endToEndId) {
          await this.prisma.pixTransactionDetail.upsert({
            where: { transactionId: txn.id },
            create: {
              transactionId: txn.id,
              endToEndId: tx.endToEndId,
            },
            update: { endToEndId: tx.endToEndId },
          });
        }
      }
      if (page.nextCursor) {
        await this.prisma.bankSyncJob.update({
          where: { id: jobId },
          data: { cursor: page.nextCursor },
        });
      }
    }
  }

  private async tenantForConnection(connectionId: string): Promise<string | undefined> {
    const conn = await this.prisma.bankConnection.findUnique({
      where: { id: connectionId },
      select: { tenantId: true },
    });
    return conn?.tenantId;
  }

  private requireTenant(): string {
    const tenantId = tenantStorage.getStore()?.tenantId;
    if (!tenantId) {
      throw new NotFoundException('Tenant ausente.');
    }
    return tenantId;
  }
}
