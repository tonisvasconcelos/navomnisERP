import { BankTransactionType } from '@prisma/client';
import { matchExact, matchPix, suggestMatches } from './reconciliation-matcher';

describe('ReconciliationMatcher', () => {
  const txn = {
    id: 'tx-1',
    amount: 100,
    bookedAt: new Date('2026-05-10T12:00:00Z'),
    transactionType: BankTransactionType.CREDIT,
    documentNumber: 'DOC-9',
    endToEndId: 'E123',
  };

  const candidates = [
    {
      targetType: 'CUSTOMER_LEDGER',
      targetId: 'ar-1',
      amount: 100,
      postingDate: new Date('2026-05-10T08:00:00Z'),
      documentNumber: 'DOC-9',
    },
    {
      targetType: 'CUSTOMER_LEDGER',
      targetId: 'ar-2',
      amount: 100,
      postingDate: new Date('2026-05-10T08:00:00Z'),
      endToEndId: 'E123',
    },
  ];

  it('matches exact document + amount + date', () => {
    const m = matchExact(txn, candidates);
    expect(m?.matcher).toBe('exact');
    expect(m?.targetId).toBe('ar-1');
  });

  it('matches pix by endToEndId', () => {
    const pixTxn = { ...txn, transactionType: BankTransactionType.PIX };
    const m = matchPix(pixTxn, candidates);
    expect(m?.matcher).toBe('pix');
    expect(m?.targetId).toBe('ar-2');
  });

  it('returns ranked suggestions', () => {
    const list = suggestMatches(txn, candidates, { amountTolerance: 0.01, dayTolerance: 3 });
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].confidence).toBeGreaterThanOrEqual(list[list.length - 1].confidence);
  });
});
