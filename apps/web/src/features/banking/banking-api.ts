import { api } from '@/shared/api/client';

export function unwrap<T>(envelope: unknown): T {
  return ((envelope as { data?: T }).data ?? envelope) as T;
}

export type Institution = {
  id: string;
  participantId: string;
  brandName: string;
  ispb: string;
  compe: string | null;
};

export type ConnectStart = {
  connectionId: string;
  consentId: string;
  sessionId: string;
  authorizationUrl: string;
};

export type DashboardSummary = {
  totalBalance: number;
  accountCount: number;
  connectionCount: number;
  pendingReconciliationCount: number;
  recentTransactions: {
    id: string;
    amount: number;
    bookedAt: string;
    description: string | null;
    transactionType: string;
  }[];
};

export const bankingApi = {
  institutions: () => api.get('/banking/institutions').then((r) => unwrap<Institution[]>(r.data)),
  startConnection: (companyId: string, institutionId: string) =>
    api
      .post('/banking/connections', { companyId, institutionId })
      .then((r) => unwrap<ConnectStart>(r.data)),
  connections: (companyId: string) =>
    api.get('/banking/connections', { params: { companyId } }).then((r) => unwrap<unknown[]>(r.data)),
  dashboard: (companyId: string) =>
    api.get('/banking/dashboard/summary', { params: { companyId } }).then((r) => unwrap<DashboardSummary>(r.data)),
  transactions: (companyId: string, params?: Record<string, string>) =>
    api
      .get('/banking/transactions', { params: { companyId, ...params } })
      .then((r) => unwrap<unknown[]>(r.data)),
  pix: (companyId: string, endToEndId?: string) =>
    api
      .get('/banking/pix', { params: { companyId, endToEndId } })
      .then((r) => unwrap<unknown[]>(r.data)),
  reconciliationSuggestions: (companyId: string) =>
    api
      .get('/banking/reconciliation/suggestions', { params: { companyId } })
      .then((r) => unwrap<{ bankTransactionId: string; matches: { targetId: string; confidence: number; matcher: string }[] }[]>(r.data)),
  confirmMatch: (matchId: string, companyId: string) =>
    api.post(`/banking/matches/${matchId}/confirm`, { companyId }).then((r) => unwrap<unknown>(r.data)),
};
