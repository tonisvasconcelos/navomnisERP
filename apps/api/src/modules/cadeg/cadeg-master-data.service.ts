import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApprovalDocumentType, PartyKind } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { decodeCsvBuffer, parseSemicolonCsv, type ParsedCsvRow } from '../imports/csv-parser.util';
import { ImportsService } from '../imports/imports.service';
import { UomService } from '../uom/uom.service';
import { legacyAliasToUomCode } from './cadeg-legacy-uom.map';

export type CadegProvisionResult = {
  tenantId: string;
  companyId: string;
  dataDir: string;
  items: number;
  customers: number;
  suppliers: number;
  uomAliases: number;
  supplierItemLinks: number;
  purchaseItems: number;
  transactionBatchId?: string;
};

const SALES_FILE_CANDIDATES = ['exportar vendas.csv', 'Exportar vendas.csv'];
const PURCHASES_FILE_CANDIDATES = ['Exportar compras.csv', 'exportar compras.csv'];

@Injectable()
export class CadegMasterDataService {
  private readonly logger = new Logger(CadegMasterDataService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly uom: UomService,
    private readonly imports: ImportsService,
  ) {}

  resolveDataDir(override?: string): string {
    const configured = this.config.get<string>('cadeg.dataDir');
    const fallback = path.join(process.cwd(), 'CADEG DATA BASE');
    const dir = override ?? (configured?.trim() ? configured : fallback);
    if (!fs.existsSync(dir)) {
      throw new BadRequestException(`Pasta CADEG não encontrada: ${dir}`);
    }
    return path.resolve(dir);
  }

  private findFile(dataDir: string, candidates: string[]): string {
    for (const name of candidates) {
      const full = path.join(dataDir, name);
      if (fs.existsSync(full)) return full;
    }
    throw new BadRequestException(
      `Ficheiro não encontrado em ${dataDir}. Esperado: ${candidates.join(' ou ')}`,
    );
  }

  async provisionTenant(
    tenantId: string,
    options?: { dataDir?: string; stageTransactions?: boolean },
  ): Promise<CadegProvisionResult> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado.');

    const dataDir = this.resolveDataDir(options?.dataDir);
    const salesPath = this.findFile(dataDir, SALES_FILE_CANDIDATES);
    const purchasesPath = this.findFile(dataDir, PURCHASES_FILE_CANDIDATES);

    this.logger.log(`CADEG provision tenant=${tenantId} dir=${dataDir}`);

    await this.uom.seedStandardUnits(tenantId);
    const company = await this.ensureCompany(tenantId, tenant.name);
    await this.ensureDefaultApprovalPolicy(tenantId);

    const salesText = decodeCsvBuffer(fs.readFileSync(salesPath));
    const { rows: salesRows } = parseSemicolonCsv(salesText);
    const purchasesText = decodeCsvBuffer(fs.readFileSync(purchasesPath));
    const { rows: purchaseRows } = parseSemicolonCsv(purchasesText);

    const master = this.extractMasterFromSales(salesRows);
    this.mergePurchaseItems(master, purchaseRows);

    const uomAliasesCreated = await this.registerLegacyUomAliases(tenantId, master.uomAliases);
    const kgUom = await this.prisma.unitOfMeasure.findFirst({
      where: { tenantId, code: 'KG' },
    });

    let itemsUpserted = 0;
    for (const item of master.items.values()) {
      await this.prisma.item.upsert({
        where: { tenantId_sku: { tenantId, sku: item.sku } },
        update: { name: item.name, isActive: true },
        create: {
          tenantId,
          sku: item.sku,
          name: item.name,
          baseUom: item.defaultUomCode ?? 'KG',
          baseUomId: kgUom?.id,
        },
      });
      itemsUpserted++;
    }

    let customersCreated = 0;
    for (const c of master.customers.values()) {
      const existing = await this.prisma.party.findFirst({
        where: { tenantId, kind: PartyKind.CUSTOMER, taxId: c.code },
      });
      if (existing) {
        await this.prisma.party.update({
          where: { id: existing.id },
          data: { name: c.name },
        });
      } else {
        await this.prisma.party.create({
          data: {
            tenantId,
            kind: PartyKind.CUSTOMER,
            name: c.name,
            taxId: c.code,
          },
        });
        customersCreated++;
      }
    }

    let suppliersCreated = 0;
    const supplierByName = new Map<string, string>();
    for (const s of master.suppliers.values()) {
      let party = await this.prisma.party.findFirst({
        where: { tenantId, kind: PartyKind.SUPPLIER, name: s.name },
      });
      if (!party) {
        party = await this.prisma.party.create({
          data: { tenantId, kind: PartyKind.SUPPLIER, name: s.name },
        });
        suppliersCreated++;
      }
      supplierByName.set(s.name, party.id);
    }

    let supplierLinks = 0;
    for (const link of master.supplierItemLinks.values()) {
      const supplierId = supplierByName.get(link.supplierName);
      const item = await this.prisma.item.findFirst({
        where: { tenantId, sku: link.itemSku },
      });
      if (!supplierId || !item) continue;
      const uomCode = legacyAliasToUomCode(link.uomAlias);
      const uom = uomCode
        ? await this.prisma.unitOfMeasure.findFirst({ where: { tenantId, code: uomCode } })
        : null;
      if (!uom) continue;
      await this.prisma.supplierItemUom.upsert({
        where: {
          tenantId_supplierId_itemId: { tenantId, supplierId, itemId: item.id },
        },
        update: {
          purchaseUomId: uom.id,
          supplierSku: link.supplierSku,
        },
        create: {
          tenantId,
          supplierId,
          itemId: item.id,
          purchaseUomId: uom.id,
          supplierSku: link.supplierSku,
        },
      });
      supplierLinks++;
    }

    let transactionBatchId: string | undefined;
    if (options?.stageTransactions) {
      const buffer = fs.readFileSync(salesPath);
      const batch = await this.imports.createBatch({
        tenantId,
        companyId: company.id,
        fileName: path.basename(salesPath),
        fileType: 'SALES_CSV',
        idempotencyKey: `cadeg-provision-${tenantId}-${path.basename(salesPath)}`,
        buffer,
      });
      transactionBatchId = batch.id;
    }

    return {
      tenantId,
      companyId: company.id,
      dataDir,
      items: itemsUpserted,
      customers: customersCreated,
      suppliers: suppliersCreated,
      uomAliases: uomAliasesCreated,
      supplierItemLinks: supplierLinks,
      purchaseItems: purchaseRows.length,
      transactionBatchId,
    };
  }

  private async ensureCompany(tenantId: string, tenantName: string) {
    const existing = await this.prisma.company.findFirst({
      where: { tenantId, isHead: true, deletedAt: null },
    });
    if (existing) return existing;
    return this.prisma.company.create({
      data: { tenantId, name: tenantName || 'Matriz', isHead: true },
    });
  }

  private async ensureDefaultApprovalPolicy(tenantId: string) {
    const existing = await this.prisma.approvalPolicy.findFirst({
      where: { tenantId, documentType: ApprovalDocumentType.PURCHASE_ORDER, isActive: true },
    });
    if (existing) return;
    await this.prisma.approvalPolicy.create({
      data: {
        tenantId,
        documentType: ApprovalDocumentType.PURCHASE_ORDER,
        name: 'PO CADEG padrão',
        isActive: true,
        steps: { create: [{ sequence: 1, minApprovals: 1 }] },
      },
    });
  }

  private extractMasterFromSales(rows: ParsedCsvRow[]) {
    const items = new Map<string, { sku: string; name: string; defaultUomCode?: string }>();
    const customers = new Map<string, { code: string; name: string }>();
    const suppliers = new Map<string, { name: string }>();
    const uomAliases = new Set<string>();
    const supplierItemLinks = new Map<
      string,
      { supplierName: string; itemSku: string; uomAlias: string; supplierSku?: string }
    >();

    for (const row of rows) {
      const sku = (row['Cod. Prod'] ?? row['Cod Prod'] ?? '').trim();
      const name = (row['Produto'] ?? '').trim();
      if (sku && name) {
        const uomAlias = (row['Unidade NF'] ?? '').trim();
        const uomCode = uomAlias ? legacyAliasToUomCode(uomAlias) : undefined;
        items.set(sku, { sku, name, defaultUomCode: uomCode ?? items.get(sku)?.defaultUomCode });
        if (uomAlias) uomAliases.add(uomAlias);
      }

      const custCode = (row['Cod. Cliente'] ?? '').trim();
      const custName = (row['Cliente'] ?? '').trim();
      if (custCode && custName) customers.set(custCode, { code: custCode, name: custName });

      const supplierName = (row['Fornecedor'] ?? '').trim();
      if (supplierName) suppliers.set(supplierName, { name: supplierName });

      if (sku && supplierName) {
        const uomAlias = (row['Unidade NF'] ?? '').trim();
        const supplierSku = (row['Cód Prod no Fornecedor'] ?? row['Cod Prod no Fornecedor'] ?? '').trim();
        const key = `${supplierName}::${sku}`;
        supplierItemLinks.set(key, {
          supplierName,
          itemSku: sku,
          uomAlias,
          supplierSku: supplierSku || undefined,
        });
      }
    }

    return { items, customers, suppliers, uomAliases, supplierItemLinks };
  }

  private mergePurchaseItems(
    master: ReturnType<typeof this.extractMasterFromSales>,
    purchaseRows: ParsedCsvRow[],
  ) {
    for (const row of purchaseRows) {
      const sku = (
        row['Cód. Produto'] ??
        row['Cod. Produto'] ??
        row['Cód Produto'] ??
        row['Cod Produto'] ??
        ''
      ).trim();
      const name = (row['Produtos'] ?? row['Produto'] ?? '').trim();
      if (sku && name && !master.items.has(sku)) {
        master.items.set(sku, { sku, name, defaultUomCode: 'KG' });
      }
    }
  }

  private async registerLegacyUomAliases(tenantId: string, aliases: Set<string>) {
    let created = 0;
    for (const alias of aliases) {
      const code = legacyAliasToUomCode(alias);
      if (!code) continue;
      const uom = await this.prisma.unitOfMeasure.findFirst({ where: { tenantId, code } });
      if (!uom) continue;
      await this.prisma.unitOfMeasureAlias.upsert({
        where: { tenantId_alias: { tenantId, alias: alias.trim() } },
        update: { uomId: uom.id, source: 'legacy_import' },
        create: { tenantId, uomId: uom.id, alias: alias.trim(), source: 'legacy_import' },
      });
      created++;
    }
    return created;
  }
}
