import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantContext } from '../../tenant/tenant-storage';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  listRecent(
    take: number,
    filters?: { action?: string; entityType?: string; from?: string; to?: string },
  ) {
    const ctx = getTenantContext();
    if (!ctx) {
      throw new ForbiddenException('Contexto de tenant ausente.');
    }
    const action = filters?.action?.trim();
    const entityType = filters?.entityType?.trim();
    const from = filters?.from?.trim() ? new Date(filters.from) : undefined;
    const to = filters?.to?.trim() ? new Date(filters.to) : undefined;
    if (from && Number.isNaN(from.getTime())) {
      throw new BadRequestException('Parâmetro from inválido.');
    }
    if (to && Number.isNaN(to.getTime())) {
      throw new BadRequestException('Parâmetro to inválido.');
    }
    return this.prisma.auditLog.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...(action ? { action: { contains: action, mode: 'insensitive' as const } } : {}),
        ...(entityType ? { entityType: { equals: entityType, mode: 'insensitive' as const } } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async logMutation(input: {
    tenantId: string;
    actorId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
    req?: Request;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? undefined,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        ip: input.req?.ip,
        userAgent: typeof input.req?.get === 'function' ? input.req.get('user-agent') ?? undefined : undefined,
      },
    });
  }
}
