import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BankConnectionStatus, BankingAccessAction } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { tenantStorage } from '../../../tenant/tenant-storage';
import { BankingAccessLogService } from '../banking-access-log.service';
import { ConsentOAuthService } from '../consent/consent-oauth.service';

@Injectable()
export class BankConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessLog: BankingAccessLogService,
    private readonly consentOAuth: ConsentOAuthService,
  ) {}

  async list(companyId: string) {
    const tenantId = this.requireTenant();
    await this.accessLog.log(BankingAccessAction.READ_ACCOUNTS, {
      companyId,
      resource: 'connections',
    });
    return this.prisma.bankConnection.findMany({
      where: { tenantId, companyId },
      include: {
        institution: { select: { brandName: true, participantId: true } },
        consents: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, expiresAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async startConnection(companyId: string, institutionId: string, userId: string) {
    const tenantId = this.requireTenant();
    const institution = await this.prisma.financialInstitution.findFirst({
      where: { id: institutionId, isActive: true },
    });
    if (!institution) {
      throw new NotFoundException('Instituição não encontrada.');
    }
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, tenantId },
    });
    if (!company) {
      throw new NotFoundException('Empresa não encontrada.');
    }

    let connection = await this.prisma.bankConnection.findUnique({
      where: {
        tenantId_companyId_institutionId: { tenantId, companyId, institutionId },
      },
    });
    if (!connection) {
      connection = await this.prisma.bankConnection.create({
        data: {
          tenantId,
          companyId,
          institutionId,
          status: BankConnectionStatus.PENDING_CONSENT,
        },
      });
    }

    const session = await this.consentOAuth.startConsentSession({
      tenantId,
      companyId,
      connectionId: connection.id,
      userId,
      participantId: institution.participantId,
    });

    await this.accessLog.log(BankingAccessAction.START_CONSENT, {
      companyId,
      resource: connection.id,
    });

    return {
      connectionId: connection.id,
      consentId: session.consentId,
      sessionId: session.sessionId,
      authorizationUrl: session.authorizationUrl,
    };
  }

  private requireTenant(): string {
    const tenantId = tenantStorage.getStore()?.tenantId;
    if (!tenantId) {
      throw new ConflictException('Contexto de tenant ausente.');
    }
    return tenantId;
  }
}
