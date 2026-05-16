import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BankConnectionStatus,
  BankConsentStatus,
  BankingAccessAction,
} from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { OPEN_FINANCE_CLIENT } from '../banking.constants';
import { BankingAccessLogService } from '../banking-access-log.service';
import { CredentialVaultService } from '../vault/credential-vault.service';
import type { OpenFinanceClient } from '../open-finance/open-finance-client.interface';
import { assertConsentTransition } from './consent-state-machine';

@Injectable()
export class ConsentOAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly vault: CredentialVaultService,
    private readonly accessLog: BankingAccessLogService,
    @Inject(OPEN_FINANCE_CLIENT) private readonly ofClient: OpenFinanceClient,
  ) {}

  async startConsentSession(params: {
    tenantId: string;
    companyId: string;
    connectionId: string;
    userId: string;
    participantId: string;
  }) {
    const redirectUri = this.redirectUri();
    const consent = await this.prisma.bankConsent.create({
      data: {
        tenantId: params.tenantId,
        companyId: params.companyId,
        connectionId: params.connectionId,
        authorizedById: params.userId,
        status: BankConsentStatus.AWAITING_AUTHORISATION,
        scopes: ['accounts', 'credit-cards-accounts'],
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const state = randomBytes(16).toString('hex');

    const oauthSession = await this.prisma.bankOAuthSession.create({
      data: {
        tenantId: params.tenantId,
        consentId: consent.id,
        state,
        codeVerifier,
        redirectUri,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const authorizationUrl = await this.ofClient.buildAuthorizationUrl({
      participantId: params.participantId,
      state,
      codeChallenge,
      redirectUri,
      scopes: ['accounts'],
    });

    return {
      consentId: consent.id,
      sessionId: oauthSession.id,
      authorizationUrl,
    };
  }

  async handleCallback(state: string, code: string) {
    const session = await this.prisma.bankOAuthSession.findUnique({
      where: { state },
      include: {
        consent: {
          include: {
            connection: { include: { institution: true } },
          },
        },
      },
    });
    if (!session || session.consumedAt || session.expiresAt < new Date()) {
      throw new BadRequestException('Sessão OAuth inválida ou expirada.');
    }

    const consent = session.consent;
    try {
      assertConsentTransition(consent.status, BankConsentStatus.AUTHORISED);
    } catch {
      throw new BadRequestException('Estado de consentimento inválido para autorização.');
    }

    const tokens = await this.ofClient.exchangeAuthorizationCode({
      participantId: consent.connection.institution.participantId,
      code,
      codeVerifier: session.codeVerifier,
      redirectUri: session.redirectUri,
    });

    const encrypted = this.vault.encryptTokens({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    });

    await this.prisma.$transaction([
      this.prisma.bankOAuthSession.update({
        where: { id: session.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.bankConsent.update({
        where: { id: consent.id },
        data: {
          status: BankConsentStatus.AUTHORISED,
          authorisedAt: new Date(),
          externalId: `of-consent-${consent.id.slice(0, 8)}`,
          expiresAt: encrypted.expiresAt,
        },
      }),
      this.prisma.bankCredentialVault.upsert({
        where: { consentId: consent.id },
        create: {
          tenantId: consent.tenantId,
          consentId: consent.id,
          accessCipher: encrypted.accessCipher,
          accessIv: encrypted.accessIv,
          refreshCipher: encrypted.refreshCipher,
          refreshIv: encrypted.refreshIv,
          keyVersion: encrypted.keyVersion,
          expiresAt: encrypted.expiresAt,
        },
        update: {
          accessCipher: encrypted.accessCipher,
          accessIv: encrypted.accessIv,
          refreshCipher: encrypted.refreshCipher,
          refreshIv: encrypted.refreshIv,
          expiresAt: encrypted.expiresAt,
          rotatedAt: new Date(),
        },
      }),
      this.prisma.bankConnection.update({
        where: { id: consent.connectionId },
        data: { status: BankConnectionStatus.ACTIVE },
      }),
    ]);

    await this.accessLog.log(BankingAccessAction.START_CONSENT, {
      companyId: consent.companyId,
      resource: consent.id,
    });

    return { consentId: consent.id, status: BankConsentStatus.AUTHORISED };
  }

  async revokeConsent(consentId: string) {
    const consent = await this.prisma.bankConsent.findUnique({
      where: { id: consentId },
      include: {
        credential: true,
        connection: { include: { institution: true } },
      },
    });
    if (!consent?.credential) {
      throw new NotFoundException('Consentimento não encontrado.');
    }
    try {
      assertConsentTransition(consent.status, BankConsentStatus.REVOKED);
    } catch {
      throw new BadRequestException('Estado de consentimento inválido para revogação.');
    }

    const accessToken = this.vault.decryptAccessToken(
      consent.credential.accessCipher,
      consent.credential.accessIv,
      consent.credential.keyVersion,
    );
    await this.ofClient.revokeConsent({
      participantId: consent.connection.institution.participantId,
      accessToken,
    });

    await this.prisma.$transaction([
      this.prisma.bankConsent.update({
        where: { id: consentId },
        data: { status: BankConsentStatus.REVOKED, revokedAt: new Date() },
      }),
      this.prisma.bankConnection.update({
        where: { id: consent.connectionId },
        data: { status: BankConnectionStatus.REVOKED, syncEnabled: false },
      }),
      this.prisma.bankCredentialVault.delete({ where: { consentId } }),
    ]);

    await this.accessLog.log(BankingAccessAction.REVOKE_CONSENT, {
      companyId: consent.companyId,
      resource: consentId,
    });

    return { consentId, status: BankConsentStatus.REVOKED };
  }

  async getConsentWithConnection(consentId: string) {
    return this.prisma.bankConsent.findUnique({
      where: { id: consentId },
      select: { id: true, connectionId: true, tenantId: true },
    });
  }

  async expireStaleConsents(): Promise<number> {
    const now = new Date();
    const stale = await this.prisma.bankConsent.findMany({
      where: {
        status: { in: [BankConsentStatus.AWAITING_AUTHORISATION, BankConsentStatus.AUTHORISED] },
        expiresAt: { lt: now },
      },
    });
    for (const c of stale) {
      await this.prisma.bankConsent.update({
        where: { id: c.id },
        data: { status: BankConsentStatus.EXPIRED },
      });
    }
    return stale.length;
  }

  private redirectUri(): string {
    return (
      this.config.get<string>('openFinance.redirectUri') ??
      process.env.OF_REDIRECT_URI ??
      'http://localhost:3000/api/v1/banking/oauth/callback'
    );
  }
}
