import { Injectable } from '@nestjs/common';
import type {
  OfAccountDto,
  OfBalanceDto,
  OfInstitutionMeta,
  OfTokenResponse,
  OfTransactionDto,
  OpenFinanceClient,
} from './open-finance-client.interface';

@Injectable()
export class SandboxOpenFinanceClient implements OpenFinanceClient {
  async resolveInstitution(participantId: string): Promise<OfInstitutionMeta> {
    return {
      participantId,
      brandName: participantId,
      authorizationUrl: `https://sandbox.openfinancebrasil.org.br/auth/${participantId}`,
      tokenUrl: `https://sandbox.openfinancebrasil.org.br/token/${participantId}`,
    };
  }

  async buildAuthorizationUrl(params: {
    participantId: string;
    state: string;
    codeChallenge: string;
    redirectUri: string;
    scopes: string[];
  }): Promise<string> {
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: 'sandbox-client',
      redirect_uri: params.redirectUri,
      scope: params.scopes.join(' '),
      state: params.state,
      code_challenge: params.codeChallenge,
      code_challenge_method: 'S256',
    });
    const meta = await this.resolveInstitution(params.participantId);
    return `${meta.authorizationUrl}?${q.toString()}`;
  }

  async exchangeAuthorizationCode(_params: {
    participantId: string;
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<OfTokenResponse> {
    return {
      accessToken: `sandbox-access-${Date.now()}`,
      refreshToken: `sandbox-refresh-${Date.now()}`,
      expiresIn: 3600,
      scope: 'accounts',
    };
  }

  async revokeConsent(_params: { participantId: string; accessToken: string }): Promise<void> {
    return;
  }

  async listAccounts(_accessToken: string, participantId: string): Promise<OfAccountDto[]> {
    return [
      {
        externalId: `${participantId}-acc-1`,
        accountType: 'CHECKING',
        branchNumber: '0001',
        accountNumber: '123456',
        checkDigit: '7',
        currency: 'BRL',
        displayName: 'Conta corrente sandbox',
      },
    ];
  }

  async listTransactions(
    _accessToken: string,
    participantId: string,
    accountExternalId: string,
    from?: Date,
    _cursor?: string,
  ): Promise<{ items: OfTransactionDto[]; nextCursor?: string }> {
    const bookedAt = from ?? new Date();
    return {
      items: [
        {
          externalId: `${accountExternalId}-tx-1`,
          transactionType: 'PIX',
          amount: 150.5,
          bookedAt,
          description: 'Pix recebido sandbox',
          endToEndId: `E${participantId.replace(/\D/g, '').slice(0, 8)}${Date.now()}`,
        },
        {
          externalId: `${accountExternalId}-tx-2`,
          transactionType: 'DEBIT',
          amount: -45.0,
          bookedAt,
          description: 'Tarifa sandbox',
        },
      ],
    };
  }

  async getBalance(
    _accessToken: string,
    _participantId: string,
    _accountExternalId: string,
  ): Promise<OfBalanceDto> {
    return { amount: 10500.5, asOf: new Date() };
  }
}
