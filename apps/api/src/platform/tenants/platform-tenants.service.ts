import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantStatus } from '@prisma/client';
import { CadegMasterDataService } from '../../modules/cadeg/cadeg-master-data.service';
import { PlatformPrismaService } from '../../prisma/platform-prisma.service';
import type { CreateTenantDto } from './dto/create-tenant.dto';
import type { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class PlatformTenantsService {
  constructor(
    private readonly prisma: PlatformPrismaService,
    private readonly cadeg: CadegMasterDataService,
  ) {}

  list(params: { search?: string; status?: TenantStatus; skip?: number; take?: number }) {
    const where = {
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' as const } },
              { slug: { contains: params.search, mode: 'insensitive' as const } },
              { legalName: { contains: params.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    return this.prisma.$transaction([
      this.prisma.tenant.findMany({
        where,
        skip: params.skip ?? 0,
        take: params.take ?? 50,
        orderBy: { createdAt: 'desc' },
        include: { branding: true, subscription: { include: { plan: true } } },
      }),
      this.prisma.tenant.count({ where }),
    ]);
  }

  get(id: string) {
    return this.prisma.tenant.findFirst({
      where: { id, deletedAt: null },
      include: { branding: true, subscription: { include: { plan: true } }, userTenants: { include: { user: true } } },
    });
  }

  async create(dto: CreateTenantDto) {
    const tenant = await this.prisma.tenant.create({
      data: {
        slug: dto.slug,
        name: dto.name,
        legalName: dto.legalName,
        status: dto.status ?? TenantStatus.PENDING_ACTIVATION,
        timezone: dto.timezone ?? 'America/Sao_Paulo',
        defaultLanguage: dto.defaultLanguage ?? 'pt-BR',
        countryCode: dto.countryCode ?? 'BR',
        taxId: dto.taxId,
        trialEndsAt: dto.trialEndsAt,
        branding: {
          create: {
            logoUrl: dto.logoUrl,
            legalDisplayName: dto.legalDisplayName,
            customDomain: dto.customDomain,
          },
        },
      },
      include: { branding: true },
    });

    if (dto.provisionCadegMaster) {
      await this.cadeg.provisionTenant(tenant.id, {
        dataDir: dto.cadegDataDir,
        stageTransactions: dto.stageCadegTransactions ?? false,
      });
    }

    return this.get(tenant.id);
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.ensureExists(id);
    return this.prisma.tenant.update({
      where: { id },
      data: {
        name: dto.name,
        legalName: dto.legalName,
        timezone: dto.timezone,
        defaultLanguage: dto.defaultLanguage,
        countryCode: dto.countryCode,
        taxId: dto.taxId,
        trialEndsAt: dto.trialEndsAt,
        branding: dto.branding
          ? {
              upsert: {
                create: { ...dto.branding },
                update: { ...dto.branding },
              },
            }
          : undefined,
      },
      include: { branding: true, subscription: { include: { plan: true } } },
    });
  }

  async setStatus(id: string, status: TenantStatus) {
    await this.ensureExists(id);
    const now = new Date();
    return this.prisma.tenant.update({
      where: { id },
      data: {
        status,
        suspendedAt: status === TenantStatus.SUSPENDED ? now : null,
        blockedAt: status === TenantStatus.BLOCKED ? now : null,
        deletedAt: null,
      },
    });
  }

  async softDelete(id: string) {
    await this.ensureExists(id);
    return this.prisma.tenant.update({
      where: { id },
      data: { deletedAt: new Date(), status: TenantStatus.SUSPENDED },
    });
  }

  async restore(id: string) {
    return this.prisma.tenant.update({
      where: { id },
      data: { deletedAt: null, status: TenantStatus.ACTIVE },
    });
  }

  private async ensureExists(id: string) {
    const t = await this.prisma.tenant.findUnique({ where: { id } });
    if (!t) {
      throw new NotFoundException('Tenant não encontrado.');
    }
  }
}
