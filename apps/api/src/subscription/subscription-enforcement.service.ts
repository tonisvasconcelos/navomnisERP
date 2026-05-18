import { Injectable } from '@nestjs/common';
import { QuotaResource, TenantStatus, TenantSubscriptionStatus } from '@prisma/client';
import { PlatformPrismaService } from '../prisma/platform-prisma.service';

@Injectable()
export class SubscriptionEnforcementService {
  constructor(private readonly prisma: PlatformPrismaService) {}

  async getTenantGate(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscription: { include: { plan: { include: { features: true, quotas: true } } } },
        featureOverrides: true,
      },
    });
    if (!tenant) {
      return { allowed: false, reason: 'tenant_not_found' };
    }
    if (tenant.deletedAt || tenant.status === TenantStatus.BLOCKED || tenant.status === TenantStatus.SUSPENDED) {
      return { allowed: false, reason: 'tenant_blocked' };
    }
    const sub = tenant.subscription;
    if (
      sub &&
      (sub.status === TenantSubscriptionStatus.SUSPENDED ||
        sub.status === TenantSubscriptionStatus.CANCELLED ||
        sub.status === TenantSubscriptionStatus.EXPIRED)
    ) {
      return { allowed: false, reason: 'subscription_inactive' };
    }
    return { allowed: true, tenant, subscription: sub };
  }

  isModuleEnabled(
    moduleKey: string,
    planFeatures: { moduleKey: string; enabled: boolean }[],
    overrides: { moduleKey: string; enabled: boolean }[],
  ): boolean {
    const override = overrides.find((o) => o.moduleKey === moduleKey);
    if (override) {
      return override.enabled;
    }
    const feature = planFeatures.find((f) => f.moduleKey === moduleKey);
    return feature?.enabled ?? false;
  }

  async checkQuota(tenantId: string, resource: QuotaResource): Promise<{ ok: boolean; limit?: number; used?: number }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: { include: { plan: { include: { quotas: true } } } } },
    });
    const quota = tenant?.subscription?.plan.quotas.find((q) => q.resource === resource);
    if (!quota) {
      return { ok: true };
    }
    const periodKey = new Date().toISOString().slice(0, 7);
    const snap = await this.prisma.tenantUsageSnapshot.findUnique({
      where: { tenantId_resource_periodKey: { tenantId, resource, periodKey } },
    });
    const used = snap?.usedValue ?? 0;
    return { ok: used < quota.limitValue, limit: quota.limitValue, used };
  }
}
