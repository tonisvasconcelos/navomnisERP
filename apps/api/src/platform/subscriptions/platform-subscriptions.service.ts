import { Injectable, NotFoundException } from '@nestjs/common';
import { SubscriptionPlanType, TenantSubscriptionStatus } from '@prisma/client';
import { PlatformPrismaService } from '../../prisma/platform-prisma.service';
import type { CreatePlanDto } from './dto/create-plan.dto';
import type { AssignSubscriptionDto } from './dto/assign-subscription.dto';

@Injectable()
export class PlatformSubscriptionsService {
  constructor(private readonly prisma: PlatformPrismaService) {}

  listPlans(activeOnly = true) {
    return this.prisma.subscriptionPlan.findMany({
      where: activeOnly ? { isActive: true, archivedAt: null } : {},
      include: { features: true, quotas: true },
      orderBy: { priceCents: 'asc' },
    });
  }

  getPlan(id: string) {
    return this.prisma.subscriptionPlan.findUnique({
      where: { id },
      include: { features: true, quotas: true },
    });
  }

  createPlan(dto: CreatePlanDto) {
    return this.prisma.subscriptionPlan.create({
      data: {
        code: dto.code,
        name: dto.name,
        planType: dto.planType ?? SubscriptionPlanType.STARTER,
        description: dto.description,
        priceCents: dto.priceCents ?? 0,
        currency: dto.currency ?? 'BRL',
        billingCycle: dto.billingCycle ?? 'monthly',
        trialDays: dto.trialDays ?? 14,
        features: dto.features?.length
          ? { create: dto.features.map((f) => ({ moduleKey: f.moduleKey, enabled: f.enabled ?? true })) }
          : undefined,
        quotas: dto.quotas?.length
          ? { create: dto.quotas.map((q) => ({ resource: q.resource, limitValue: q.limitValue })) }
          : undefined,
      },
      include: { features: true, quotas: true },
    });
  }

  async assignToTenant(tenantId: string, dto: AssignSubscriptionDto) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: dto.planId } });
    if (!plan) {
      throw new NotFoundException('Plano não encontrado.');
    }
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    return this.prisma.tenantSubscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planId: dto.planId,
        status: dto.status ?? TenantSubscriptionStatus.ACTIVE,
        currentPeriodEnd: periodEnd,
        graceEndsAt: dto.graceEndsAt ? new Date(dto.graceEndsAt) : null,
      },
      update: {
        planId: dto.planId,
        status: dto.status ?? TenantSubscriptionStatus.ACTIVE,
        graceEndsAt: dto.graceEndsAt ? new Date(dto.graceEndsAt) : null,
        cancelledAt: null,
      },
      include: { plan: true },
    });
  }

  async suspendSubscription(tenantId: string) {
    return this.prisma.tenantSubscription.update({
      where: { tenantId },
      data: { status: TenantSubscriptionStatus.SUSPENDED },
    });
  }

  async cancelSubscription(tenantId: string) {
    return this.prisma.tenantSubscription.update({
      where: { tenantId },
      data: { status: TenantSubscriptionStatus.CANCELLED, cancelledAt: new Date() },
    });
  }

  deactivatePlan(id: string) {
    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: { isActive: false },
    });
  }

  archivePlan(id: string) {
    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: { isActive: false, archivedAt: new Date() },
    });
  }
}
