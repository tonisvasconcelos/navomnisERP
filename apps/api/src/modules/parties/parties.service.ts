import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PartyKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantContext } from '../../tenant/tenant-storage';
import { AuditService } from '../audit/audit.service';
import type { CreateCustomerDto } from './dto/create-customer.dto';

@Injectable()
export class PartiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listCompanies() {
    const ctx = getTenantContext();
    if (!ctx) {
      throw new ForbiddenException('Contexto de tenant ausente.');
    }
    return this.prisma.company.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
      take: 200,
    });
  }

  listVendors() {
    const ctx = getTenantContext();
    if (!ctx) {
      throw new ForbiddenException('Contexto de tenant ausente.');
    }
    return this.prisma.party.findMany({
      where: {
        tenantId: ctx.tenantId,
        kind: { in: [PartyKind.SUPPLIER, PartyKind.BOTH] },
      },
      orderBy: { name: 'asc' },
      take: 500,
    });
  }

  listCustomers() {
    const ctx = getTenantContext();
    if (!ctx) {
      throw new ForbiddenException('Contexto de tenant ausente.');
    }
    return this.prisma.party.findMany({
      where: {
        tenantId: ctx.tenantId,
        kind: { in: [PartyKind.CUSTOMER, PartyKind.BOTH] },
      },
      orderBy: { name: 'asc' },
      take: 500,
    });
  }

  async createCustomer(dto: CreateCustomerDto, req?: Request) {
    const ctx = getTenantContext();
    if (!ctx) {
      throw new ForbiddenException('Contexto de tenant ausente.');
    }
    const party = await this.prisma.party.create({
      data: {
        tenantId: ctx.tenantId,
        kind: PartyKind.CUSTOMER,
        name: dto.name,
        taxId: dto.taxId,
        createdById: ctx.userId,
      },
    });
    await this.audit.logMutation({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: 'party.customer.create',
      entityType: 'Party',
      entityId: party.id,
      metadata: { name: party.name },
      req,
    });
    return party;
  }
}
