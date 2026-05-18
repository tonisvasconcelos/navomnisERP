import { Injectable } from '@nestjs/common';
import { Prisma, TelemetryEventKind } from '@prisma/client';
import { PlatformPrismaService } from '../../prisma/platform-prisma.service';

@Injectable()
export class PlatformTelemetryService {
  constructor(private readonly prisma: PlatformPrismaService) {}

  async ingest(kind: TelemetryEventKind, payload?: Record<string, unknown>, tenantId?: string) {
    return this.prisma.telemetryEvent.create({
      data: { kind, tenantId, payload: (payload ?? {}) as Prisma.InputJsonValue },
    });
  }

  async dashboardMetrics() {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [activeTenants, activeUsers, events24h, apiRollups] = await Promise.all([
      this.prisma.tenant.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, blockedAt: null } }),
      this.prisma.telemetryEvent.count({ where: { createdAt: { gte: dayAgo } } }),
      this.prisma.apiUsageRollup.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    return { activeTenants, activeUsers, events24h, apiRollups };
  }

  listEvents(params: { kind?: TelemetryEventKind; tenantId?: string; take?: number }) {
    return this.prisma.telemetryEvent.findMany({
      where: {
        ...(params.kind ? { kind: params.kind } : {}),
        ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: params.take ?? 100,
    });
  }

  async recordQueueHealth(queueName: string, stats: { waiting: number; active: number; failed: number; completed: number }) {
    return this.prisma.queueHealthSnapshot.create({
      data: { queueName, ...stats },
    });
  }
}
