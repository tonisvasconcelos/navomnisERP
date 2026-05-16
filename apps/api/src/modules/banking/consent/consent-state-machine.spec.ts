import { BankConsentStatus } from '@prisma/client';
import {
  assertConsentTransition,
  canTransitionConsent,
  isConsentActive,
} from './consent-state-machine';

describe('ConsentStateMachine', () => {
  it('allows awaiting → authorised', () => {
    expect(
      canTransitionConsent(
        BankConsentStatus.AWAITING_AUTHORISATION,
        BankConsentStatus.AUTHORISED,
      ),
    ).toBe(true);
  });

  it('blocks authorised → awaiting', () => {
    expect(() =>
      assertConsentTransition(BankConsentStatus.AUTHORISED, BankConsentStatus.AWAITING_AUTHORISATION),
    ).toThrow();
  });

  it('detects active consent', () => {
    expect(isConsentActive(BankConsentStatus.AUTHORISED)).toBe(true);
    expect(isConsentActive(BankConsentStatus.REVOKED)).toBe(false);
  });
});
