import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantContext } from '../../tenant/tenant-storage';
import type { CreateItemConversionDto, CreateUomAliasDto, CreateUomDto } from './dto/uom.dto';

@Injectable()
export class UomService {
  constructor(private readonly prisma: PrismaService) {}

  private ctx() {
    const c = getTenantContext();
    if (!c) throw new ForbiddenException('Contexto de tenant ausente.');
    return c;
  }

  listUnits() {
    const { tenantId } = this.ctx();
    return this.prisma.unitOfMeasure.findMany({
      where: { tenantId, isActive: true },
      orderBy: { code: 'asc' },
    });
  }

  createUnit(dto: CreateUomDto) {
    const { tenantId } = this.ctx();
    return this.prisma.unitOfMeasure.create({
      data: {
        tenantId,
        code: dto.code.toUpperCase(),
        name: dto.name,
        kind: dto.kind ?? 'OTHER',
        decimalScale: dto.decimalScale ?? 3,
      },
    });
  }

  updateUnit(id: string, dto: Partial<CreateUomDto>) {
    const { tenantId } = this.ctx();
    return this.prisma.unitOfMeasure.update({
      where: { id, tenantId },
      data: {
        name: dto.name,
        kind: dto.kind,
        decimalScale: dto.decimalScale,
        isActive: dto.code ? undefined : undefined,
      },
    });
  }

  listAliases() {
    const { tenantId } = this.ctx();
    return this.prisma.unitOfMeasureAlias.findMany({
      where: { tenantId },
      include: { uom: true },
      take: 500,
    });
  }

  createAlias(dto: CreateUomAliasDto) {
    const { tenantId } = this.ctx();
    return this.prisma.unitOfMeasureAlias.create({
      data: { tenantId, uomId: dto.uomId, alias: dto.alias.trim() },
    });
  }

  listItemConversions(itemId: string) {
    const { tenantId } = this.ctx();
    return this.prisma.itemUomConversion.findMany({
      where: { tenantId, itemId },
      include: { fromUom: true, toUom: true },
      orderBy: { validFrom: 'desc' },
    });
  }

  createItemConversion(itemId: string, dto: CreateItemConversionDto) {
    const { tenantId } = this.ctx();
    return this.prisma.itemUomConversion.create({
      data: {
        tenantId,
        itemId,
        fromUomId: dto.fromUomId,
        toUomId: dto.toUomId,
        factor: new Prisma.Decimal(dto.factor),
      },
      include: { fromUom: true, toUom: true },
    });
  }

  async deleteItemConversion(itemId: string, conversionId: string) {
    const { tenantId } = this.ctx();
    const row = await this.prisma.itemUomConversion.findFirst({
      where: { id: conversionId, itemId, tenantId },
    });
    if (!row) throw new NotFoundException('Conversão não encontrada.');
    await this.prisma.itemUomConversion.delete({ where: { id: conversionId } });
    return { deleted: true };
  }

  listExceptions() {
    const { tenantId } = this.ctx();
    return this.prisma.uomConversionException.findMany({
      where: { tenantId, resolved: false },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  /** Seed standard CADEG UOM codes for a tenant */
  async seedStandardUnits(tenantId: string) {
    const defs = [
      { code: 'KG', name: 'Quilograma', kind: 'WEIGHT' as const },
      { code: 'UN', name: 'Unidade', kind: 'COUNT' as const },
      { code: 'CX', name: 'Caixa', kind: 'PACKAGE' as const },
      { code: 'BDJ', name: 'Bandeja', kind: 'TRAY' as const },
      { code: 'MOL', name: 'Molho', kind: 'BUNCH' as const },
      { code: 'DZ', name: 'Dúzia', kind: 'DOZEN' as const },
      { code: 'SC', name: 'Saco', kind: 'SACK' as const },
      { code: 'PCT', name: 'Pacote', kind: 'PACKAGE' as const },
    ];
    const aliases = [
      { code: 'KG', aliases: ['Kg', 'kg'] },
      { code: 'UN', aliases: ['Un', 'Und', 'UND'] },
      { code: 'CX', aliases: ['Cx'] },
      { code: 'BDJ', aliases: ['Bdj', 'Bd'] },
      { code: 'MOL', aliases: ['Mol'] },
      { code: 'DZ', aliases: ['Dz'] },
      { code: 'SC', aliases: ['Sc'] },
      { code: 'PCT', aliases: ['Pct'] },
      { code: 'CX', aliases: ['Crt', 'Car'] },
    ];
    for (const d of defs) {
      await this.prisma.unitOfMeasure.upsert({
        where: { tenantId_code: { tenantId, code: d.code } },
        update: { name: d.name },
        create: { tenantId, code: d.code, name: d.name, kind: d.kind },
      });
    }
    for (const group of aliases) {
      const uom = await this.prisma.unitOfMeasure.findUniqueOrThrow({
        where: { tenantId_code: { tenantId, code: group.code } },
      });
      for (const alias of group.aliases) {
        await this.prisma.unitOfMeasureAlias.upsert({
          where: { tenantId_alias: { tenantId, alias } },
          update: { uomId: uom.id },
          create: { tenantId, uomId: uom.id, alias, source: 'seed' },
        });
      }
    }
  }
}
