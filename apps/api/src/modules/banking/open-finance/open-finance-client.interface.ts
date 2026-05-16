export type OfInstitutionMeta = {
  participantId: string;
  brandName: string;
  authorizationUrl: string;
  tokenUrl: string;
};

export type OfTokenResponse = {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope?: string;
};

export type OfAccountDto = {
  externalId: string;
  accountType: string;
  branchNumber?: string;
  accountNumber: string;
  checkDigit?: string;
  currency: string;
  displayName?: string;
};

export type OfTransactionDto = {
  externalId: string;
  transactionType: string;
  amount: number;
  bookedAt: Date;
  description?: string;
  documentNumber?: string;
  endToEndId?: string;
};

export type OfBalanceDto = {
  amount: number;
  asOf: Date;
};

export interface OpenFinanceClient {
  resolveInstitution(participantId: string): Promise<OfInstitutionMeta>;
  buildAuthorizationUrl(params: {
    participantId: string;
    state: string;
    codeChallenge: string;
    redirectUri: string;
    scopes: string[];
  }): Promise<string>;
  exchangeAuthorizationCode(params: {
    participantId: string;
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<OfTokenResponse>;
  revokeConsent(params: { participantId: string; accessToken: string }): Promise<void>;
  listAccounts(accessToken: string, participantId: string): Promise<OfAccountDto[]>;
  listTransactions(
    accessToken: string,
    participantId: string,
    accountExternalId: string,
    from?: Date,
    cursor?: string,
  ): Promise<{ items: OfTransactionDto[]; nextCursor?: string }>;
  getBalance(
    accessToken: string,
    participantId: string,
    accountExternalId: string,
  ): Promise<OfBalanceDto>;
}
