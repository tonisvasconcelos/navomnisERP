export type TenantSummary = {
  id: string;
  slug: string;
  name: string;
  legalName?: string | null;
  status: string;
  countryCode?: string | null;
  taxId?: string | null;
  timezone?: string;
  defaultLanguage?: string;
  subscription?: {
    status: string;
    plan: { id: string; name: string; code: string };
  } | null;
  branding?: {
    logoUrl?: string | null;
    legalDisplayName?: string | null;
    customDomain?: string | null;
  } | null;
  userTenants?: { user: { id: string; email: string; displayName: string } }[];
};

export type UserSummary = {
  id: string;
  email: string;
  displayName: string;
  locale?: string;
  blockedAt?: string | null;
  passwordHash?: string | null;
  userTenants: { tenant: { id: string; slug: string; name: string }; isDefault: boolean }[];
  userInvites?: { id: string; expiresAt: string; acceptedAt?: string | null }[];
};

export type PlanSummary = {
  id: string;
  code: string;
  name: string;
  planType: string;
  priceCents: number;
  currency: string;
  billingCycle: string;
  trialDays: number;
  isActive: boolean;
  archivedAt?: string | null;
  description?: string | null;
};
