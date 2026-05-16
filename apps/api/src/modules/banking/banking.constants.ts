export const BANK_SYNC_QUEUE = 'bank-sync';
export const BANK_RECONCILIATION_QUEUE = 'bank-reconciliation';
export const BANK_CONSENT_QUEUE = 'bank-consent';

export const OPEN_FINANCE_CLIENT = Symbol('OPEN_FINANCE_CLIENT');

export type BankSyncJobPayload = { jobId: string };
