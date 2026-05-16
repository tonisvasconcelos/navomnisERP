import { BankConsentStatus } from '@prisma/client';

const transitions: Record<BankConsentStatus, BankConsentStatus[]> = {
  [BankConsentStatus.AWAITING_AUTHORISATION]: [
    BankConsentStatus.AUTHORISED,
    BankConsentStatus.REJECTED,
    BankConsentStatus.EXPIRED,
  ],
  [BankConsentStatus.AUTHORISED]: [BankConsentStatus.REVOKED, BankConsentStatus.EXPIRED],
  [BankConsentStatus.REJECTED]: [],
  [BankConsentStatus.EXPIRED]: [],
  [BankConsentStatus.REVOKED]: [],
};

export function canTransitionConsent(
  from: BankConsentStatus,
  to: BankConsentStatus,
): boolean {
  return transitions[from]?.includes(to) ?? false;
}

export function assertConsentTransition(
  from: BankConsentStatus,
  to: BankConsentStatus,
): void {
  if (!canTransitionConsent(from, to)) {
    throw new Error(`Transição de consentimento inválida: ${from} → ${to}`);
  }
}

export function isConsentActive(status: BankConsentStatus): boolean {
  return status === BankConsentStatus.AUTHORISED;
}
