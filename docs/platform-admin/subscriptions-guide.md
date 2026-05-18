# Subscriptions guide

Plans are defined in `SubscriptionPlan` with `PlanFeature` (module toggles) and `PlanQuota` (limits).

Assign a plan: `POST /api/v1/platform/subscriptions/tenants/:tenantId/assign`

Tenant ERP enforces subscription status and quotas via global guards (`SubscriptionStatusGuard`, `QuotaGuard`, `FeatureFlagGuard`).
