import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../widgets/app-shell';
import { LoginPage } from '../features/auth/pages/login-page';
import { InviteAcceptPage } from '../features/auth/pages/invite-accept-page';
import { useAuthStore } from '../features/auth/auth-store';

const DashboardPage = lazy(() =>
  import('../features/dashboard/dashboard-page').then((m) => ({ default: m.DashboardPage })),
);
const SalesListPage = lazy(() =>
  import('../features/sales/sales-list-page').then((m) => ({ default: m.SalesListPage })),
);
const SalesDetailPage = lazy(() =>
  import('../features/sales/sales-detail-page').then((m) => ({ default: m.SalesDetailPage })),
);
const InventoryLedgerPage = lazy(() =>
  import('../features/inventory/inventory-ledger-page').then((m) => ({ default: m.InventoryLedgerPage })),
);
const ItemDetailPage = lazy(() =>
  import('../features/inventory/item-detail-page').then((m) => ({ default: m.ItemDetailPage })),
);
const ProduceOperationsPage = lazy(() =>
  import('../features/produce/produce-operations-page').then((m) => ({ default: m.ProduceOperationsPage })),
);
const AuditLogPage = lazy(() =>
  import('../features/audit/audit-log-page').then((m) => ({ default: m.AuditLogPage })),
);
const FiscalWorkspacePage = lazy(() =>
  import('../features/fiscal/fiscal-workspace-page').then((m) => ({ default: m.FiscalWorkspacePage })),
);
const FiscalSetupPage = lazy(() =>
  import('../features/fiscal/fiscal-setup-page').then((m) => ({ default: m.FiscalSetupPage })),
);
const BankingDashboardPage = lazy(() =>
  import('../features/banking/banking-dashboard-page').then((m) => ({ default: m.BankingDashboardPage })),
);
const BankingConnectPage = lazy(() =>
  import('../features/banking/banking-connect-page').then((m) => ({ default: m.BankingConnectPage })),
);
const BankingReconciliationPage = lazy(() =>
  import('../features/banking/banking-reconciliation-page').then((m) => ({
    default: m.BankingReconciliationPage,
  })),
);
const BankingPixPage = lazy(() =>
  import('../features/banking/banking-pix-page').then((m) => ({ default: m.BankingPixPage })),
);
const PurchasesListPage = lazy(() =>
  import('../features/purchases/purchases-list-page').then((m) => ({ default: m.PurchasesListPage })),
);
const PurchasesDetailPage = lazy(() =>
  import('../features/purchases/purchases-detail-page').then((m) => ({
    default: m.PurchasesDetailPage,
  })),
);
const FinanceDashboardPage = lazy(() =>
  import('../features/finance/finance-dashboard-page').then((m) => ({
    default: m.FinanceDashboardPage,
  })),
);
const ChartOfAccountsPage = lazy(() =>
  import('../features/finance/chart-of-accounts-page').then((m) => ({
    default: m.ChartOfAccountsPage,
  })),
);
const UomMasterPage = lazy(() =>
  import('../features/uom/uom-master-page').then((m) => ({ default: m.UomMasterPage })),
);
const UomExceptionsPage = lazy(() =>
  import('../features/uom/uom-exceptions-page').then((m) => ({ default: m.UomExceptionsPage })),
);
const ApprovalsInboxPage = lazy(() =>
  import('../features/approvals/approvals-inbox-page').then((m) => ({
    default: m.ApprovalsInboxPage,
  })),
);
const ImportsWizardPage = lazy(() =>
  import('../features/imports/imports-wizard-page').then((m) => ({ default: m.ImportsWizardPage })),
);
const OperationsDashboardPage = lazy(() =>
  import('../features/dashboards/operations-dashboard-page').then((m) => ({
    default: m.OperationsDashboardPage,
  })),
);

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
      A carregar…
    </div>
  );
}

export default function App() {
  const accessToken = useAuthStore((s) => s.accessToken);

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={accessToken ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/invite/accept" element={<InviteAcceptPage />} />
        <Route
          path="/"
          element={accessToken ? <AppShell /> : <Navigate to="/login" replace />}
        >
          <Route index element={<DashboardPage />} />
          <Route path="sales" element={<SalesListPage />} />
          <Route path="sales/:id" element={<SalesDetailPage />} />
          <Route path="inventory" element={<InventoryLedgerPage />} />
          <Route path="inventory/items/:itemId" element={<ItemDetailPage />} />
          <Route path="produce" element={<ProduceOperationsPage />} />
          <Route path="audit" element={<AuditLogPage />} />
          <Route path="fiscal" element={<FiscalWorkspacePage />} />
          <Route path="fiscal/setup" element={<FiscalSetupPage />} />
          <Route path="banking" element={<BankingDashboardPage />} />
          <Route path="banking/connect" element={<BankingConnectPage />} />
          <Route path="banking/reconciliation" element={<BankingReconciliationPage />} />
          <Route path="banking/pix" element={<BankingPixPage />} />
          <Route path="purchases" element={<PurchasesListPage />} />
          <Route path="purchases/:id" element={<PurchasesDetailPage />} />
          <Route path="finance" element={<FinanceDashboardPage />} />
          <Route path="finance/accounts" element={<ChartOfAccountsPage />} />
          <Route path="operations" element={<OperationsDashboardPage />} />
          <Route path="uom" element={<UomMasterPage />} />
          <Route path="exceptions/uom" element={<UomExceptionsPage />} />
          <Route path="approvals" element={<ApprovalsInboxPage />} />
          <Route path="imports" element={<ImportsWizardPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
