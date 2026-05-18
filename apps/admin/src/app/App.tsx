import { Navigate, Route, Routes } from 'react-router-dom';
import { usePlatformAuthStore } from '@/store/auth-store';
import { AdminShell } from '@/widgets/admin-shell';
import { LoginPage } from '@/pages/login-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { TenantsPage } from '@/pages/tenants-page';
import { TenantCreatePage } from '@/pages/tenant-create-page';
import { TenantDetailPage } from '@/pages/tenant-detail-page';
import { TenantEditPage } from '@/pages/tenant-edit-page';
import { UsersPage } from '@/pages/users-page';
import { UserInvitePage } from '@/pages/user-invite-page';
import { UserDetailPage } from '@/pages/user-detail-page';
import { UserEditPage } from '@/pages/user-edit-page';
import { SubscriptionsPage, PlansListPage } from '@/pages/subscriptions-page';
import { PlanCreatePage } from '@/pages/plan-create-page';
import { PlanDetailPage } from '@/pages/plan-detail-page';
import { TelemetryPage } from '@/pages/telemetry-page';
import { LegalPage } from '@/pages/legal-page';
import { LgpdPage } from '@/pages/lgpd-page';
import { AuditPage } from '@/pages/audit-page';
import { FeaturesPage } from '@/pages/features-page';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = usePlatformAuthStore((s) => s.accessToken);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AdminShell />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="tenants" element={<TenantsPage />} />
        <Route path="tenants/new" element={<TenantCreatePage />} />
        <Route path="tenants/:id" element={<TenantDetailPage />} />
        <Route path="tenants/:id/edit" element={<TenantEditPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/invite" element={<UserInvitePage />} />
        <Route path="users/:id" element={<UserDetailPage />} />
        <Route path="users/:id/edit" element={<UserEditPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route path="subscriptions/plans" element={<PlansListPage />} />
        <Route path="subscriptions/plans/new" element={<PlanCreatePage />} />
        <Route path="subscriptions/plans/:id" element={<PlanDetailPage />} />
        <Route path="telemetry" element={<TelemetryPage />} />
        <Route path="legal" element={<LegalPage />} />
        <Route path="lgpd" element={<LgpdPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="features" element={<FeaturesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
