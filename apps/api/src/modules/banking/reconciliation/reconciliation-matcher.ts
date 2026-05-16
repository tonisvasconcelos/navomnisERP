import { BankTransactionType } from '@prisma/client';

export type ReconciliationCandidate = {
  targetType: string;
  targetId: string;
  amount: number;
  postingDate: Date;
  documentNumber?: string;
  endToEndId?: string;
  partyName?: string;
};

export type BankTxnForMatch = {
  id: string;
  amount: number;
  bookedAt: Date;
  transactionType: BankTransactionType;
  documentNumber?: string | null;
  endToEndId?: string | null;
};

export type MatchSuggestion = {
  bankTransactionId: string;
  targetType: string;
  targetId: string;
  confidence: number;
  matcher: 'exact' | 'pix' | 'fuzzy' | 'ar_ap';
};

export function matchExact(
  txn: BankTxnForMatch,
  candidates: ReconciliationCandidate[],
): MatchSuggestion | null {
  for (const c of candidates) {
    if (
      Math.abs(c.amount - Number(txn.amount)) < 0.001 &&
      sameCalendarDay(c.postingDate, txn.bookedAt) &&
      c.documentNumber &&
      txn.documentNumber &&
      c.documentNumber === txn.documentNumber
    ) {
      return buildSuggestion(txn.id, c, 1, 'exact');
    }
  }
  return null;
}

export function matchPix(
  txn: BankTxnForMatch,
  candidates: ReconciliationCandidate[],
): MatchSuggestion | null {
  if (txn.transactionType !== BankTransactionType.PIX || !txn.endToEndId) {
    return null;
  }
  for (const c of candidates) {
    if (c.endToEndId && c.endToEndId === txn.endToEndId) {
      return buildSuggestion(txn.id, c, 0.99, 'pix');
    }
  }
  return null;
}

export function matchFuzzy(
  txn: BankTxnForMatch,
  candidates: ReconciliationCandidate[],
  amountTolerance: number,
  dayTolerance: number,
): MatchSuggestion | null {
  let best: MatchSuggestion | null = null;
  for (const c of candidates) {
    const amountDiff = Math.abs(c.amount - Number(txn.amount));
    const dayDiff = Math.abs(daysBetween(c.postingDate, txn.bookedAt));
    if (amountDiff <= amountTolerance && dayDiff <= dayTolerance) {
      const confidence = Math.max(0.5, 0.95 - amountDiff - dayDiff * 0.05);
      const suggestion = buildSuggestion(txn.id, c, confidence, 'fuzzy');
      if (!best || suggestion.confidence > best.confidence) {
        best = suggestion;
      }
    }
  }
  return best;
}

export function suggestMatches(
  txn: BankTxnForMatch,
  candidates: ReconciliationCandidate[],
  opts: { amountTolerance: number; dayTolerance: number },
): MatchSuggestion[] {
  const out: MatchSuggestion[] = [];
  const exact = matchExact(txn, candidates);
  if (exact) {
    out.push(exact);
  }
  const pix = matchPix(txn, candidates);
  if (pix) {
    out.push(pix);
  }
  const fuzzy = matchFuzzy(txn, candidates, opts.amountTolerance, opts.dayTolerance);
  if (fuzzy && !out.some((s) => s.targetId === fuzzy.targetId)) {
    out.push(fuzzy);
  }
  return out.sort((a, b) => b.confidence - a.confidence);
}

function buildSuggestion(
  bankTransactionId: string,
  c: ReconciliationCandidate,
  confidence: number,
  matcher: MatchSuggestion['matcher'],
): MatchSuggestion {
  return {
    bankTransactionId,
    targetType: c.targetType,
    targetId: c.targetId,
    confidence,
    matcher,
  };
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}
