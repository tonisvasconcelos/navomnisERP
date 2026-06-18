import { Injectable, Logger } from '@nestjs/common';
import {
  DocumentStatus,
  PartyKind,
  Prisma,
  ProduceLotStatus,
} from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { decodeCsvBuffer, parseSemicolonCsv } from '../imports/csv-parser.util';
import {
  comprasProductName,
  comprasSku,
  derivePurchaseQuantity,
  isComprasTotalRow,
  lastDayOfMonthUtc,
  parseComprasExportYear,
  parseComprasMonthlyColumns,
  purchaseOrderNumberFromLegacy,
} from '../imports/legacy-csv-purchase.mapper';
import { CadegLegacyAnalyticsService } from './cadeg-legacy-analytics.service';
import { legacyAliasToUomCode } from './cadeg-legacy-uom.map';

export type CadegImportPurchasesResult = {
  ordersCreated: number;
  ordersSkipped: number;
  linesReceived: number;
  exceptions: string[];
};

export type CadegPostSalesInventoryResult = {
  ordersProcessed: number;
  linesPosted: number;
  linesSkipped: number;
  exceptions: string[];
};

const SALES_FILE_CANDIDATES = ['exportar vendas.csv', 'Exportar vendas.csv'];
const PURCHASES_FILE_CANDIDATES = ['Exportar compras.csv', 'exportar compras.csv'];

type PrismaTx = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

@Injectable()
export class CadegPurchaseReconstructionService {
  private readonly logger = new Logger(CadegPurchaseReconstructionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: CadegLegacyAnalyticsService,
  ) {}

  resolveDataDir(override?: string): string {
    const dir =
      override ??
      process.env.CADEG_DATA_DIR ??
      path.join(process.cwd(), 'CADEG DATA BASE');
    if (!fs.existsSync(dir)) {
      throw new Error(`Pasta CADEG não encontrada: ${dir}`);
    }
    return path.resolve(dir);
  }

  private findFile(dataDir: string, candidates: string[]): string {
    for (const name of candidates) {
      const full = path.join(dataDir, name);
      if (fs.existsSync(full)) return full;
    }
    throw new Error(`Ficheiro não encontrado em ${dataDir}: ${candidates.join(' ou ')}`);
  }

  async ensureDefaultWarehouse(tenantId: string) {
    let warehouse = await this.prisma.warehouse.findFirst({
      where: { tenantId, code: 'MATRIZ' },
    });
    if (!warehouse) {
      warehouse = await this.prisma.warehouse.create({
        data: { tenantId, code: 'MATRIZ', name: 'Matriz CADEG' },
      });
    }
    let zone = await this.prisma.warehouseZone.findFirst({
      where: { tenantId, warehouseId: warehouse.id, code: 'REC' },
    });
    if (!zone) {
      zone = await this.prisma.warehouseZone.create({
        data: {
          tenantId,
          warehouseId: warehouse.id,
          code: 'REC',
          name: 'Receção',
        },
      });
    }
    return { warehouse, zone };
  }

  async importPurchases(
    tenantId: string,
    options?: { dataDir?: string; dryRun?: boolean },
  ): Promise<CadegImportPurchasesResult> {
    const dataDir = this.resolveDataDir(options?.dataDir);
    const salesPath = this.findFile(dataDir, SALES_FILE_CANDIDATES);
    const purchasesPath = this.findFile(dataDir, PURCHASES_FILE_CANDIDATES);

    const company = await this.prisma.company.findFirst({
      where: { tenantId, isHead: true, deletedAt: null },
    });
    if (!company) throw new Error('Empresa matriz não encontrada para o tenant.');

    const { warehouse, zone } = await this.ensureDefaultWarehouse(tenantId);

    const salesText = decodeCsvBuffer(fs.readFileSync(salesPath));
    const { rows: salesRows } = parseSemicolonCsv(salesText);
    const salesAggregates = this.analytics.aggregateSalesRows(salesRows);

    const purchasesRaw = fs.readFileSync(purchasesPath);
    const purchasesText = decodeCsvBuffer(purchasesRaw);
    const exportYear = parseComprasExportYear(purchasesText.split(/\r?\n/)[0] ?? '');
    const { rows: comprasRows } = parseSemicolonCsv(purchasesText);

    const items = await this.prisma.item.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, sku: true, baseUomId: true },
    });
    const itemBySku = new Map(items.map((i) => [i.sku, i]));

    const suppliers = await this.prisma.party.findMany({
      where: { tenantId, kind: { in: [PartyKind.SUPPLIER, PartyKind.BOTH] } },
      select: { id: true, name: true },
    });
    const supplierByName = new Map(suppliers.map((s) => [s.name.toLowerCase(), s.id]));

    const uoms = await this.prisma.unitOfMeasure.findMany({ where: { tenantId } });
    const uomByCode = new Map(uoms.map((u) => [u.code, u.id]));

    const existingOrders = await this.prisma.purchaseOrder.findMany({
      where: { tenantId, number: { startsWith: 'PO-' } },
      select: { number: true },
    });
    const existingNumbers = new Set(existingOrders.map((o) => o.number));

    const result: CadegImportPurchasesResult = {
      ordersCreated: 0,
      ordersSkipped: 0,
      linesReceived: 0,
      exceptions: [],
    };

    for (const row of comprasRows) {
      if (isComprasTotalRow(row)) continue;
      const sku = comprasSku(row);
      if (!sku) continue;

      const item = itemBySku.get(sku);
      if (!item) {
        result.exceptions.push(`SKU ${sku} (${comprasProductName(row)}) não encontrado no catálogo.`);
        continue;
      }

      const monthly = parseComprasMonthlyColumns(row, exportYear);
      for (const period of monthly) {
        if (period.fobAmount.lte(0)) continue;

        const orderNumber = purchaseOrderNumberFromLegacy(sku, period.year, period.month);
        if (existingNumbers.has(orderNumber)) {
          result.ordersSkipped++;
          continue;
        }

        const aggregate = this.analytics.lookupAggregate(
          salesAggregates,
          sku,
          period.year,
          period.month,
        );
        const avgCost = this.analytics.avgUnitCostFob(aggregate);
        const qty = derivePurchaseQuantity(
          period.fobAmount,
          avgCost,
          aggregate?.totalQtySold,
        );
        if (!qty?.gt(0)) {
          result.exceptions.push(
            `${orderNumber}: quantidade não derivada (FOB=${period.fobAmount.toString()}).`,
          );
          continue;
        }

        const unitCost = period.fobAmount.div(qty).toDecimalPlaces(4);
        const lineTotal = period.fobAmount.toDecimalPlaces(2);

        let vendorId = aggregate?.topSupplier
          ? supplierByName.get(aggregate.topSupplier.toLowerCase())
          : undefined;
        if (!vendorId && aggregate?.topSupplier) {
          const created = await this.prisma.party.create({
            data: {
              tenantId,
              kind: PartyKind.SUPPLIER,
              name: aggregate.topSupplier,
            },
          });
          vendorId = created.id;
          supplierByName.set(aggregate.topSupplier.toLowerCase(), vendorId);
        }
        if (!vendorId) {
          vendorId = suppliers[0]?.id;
        }
        if (!vendorId) {
          const fallback = await this.prisma.party.create({
            data: { tenantId, kind: PartyKind.SUPPLIER, name: 'Fornecedor CADEG' },
          });
          vendorId = fallback.id;
          suppliers.push({ id: fallback.id, name: fallback.name });
          supplierByName.set(fallback.name.toLowerCase(), vendorId);
        }

        const uomCode = legacyAliasToUomCode(aggregate?.uomAlias ?? 'KG') ?? 'KG';
        const uomId = uomByCode.get(uomCode) ?? item.baseUomId ?? uomByCode.get('KG');

        if (options?.dryRun) {
          result.ordersCreated++;
          existingNumbers.add(orderNumber);
          continue;
        }

        await this.prisma.$transaction(async (tx: PrismaTx) => {
          const orderDate = lastDayOfMonthUtc(period.year, period.month);
          const order = await tx.purchaseOrder.create({
            data: {
              tenantId,
              companyId: company.id,
              vendorId,
              number: orderNumber,
              status: DocumentStatus.RECEIVED,
              orderDate,
              receivedAt: orderDate,
              totalAmount: lineTotal,
              legacyMetadata: {
                source: 'Exportar compras.csv',
                sku,
                productName: comprasProductName(row),
                month: period.month,
                year: period.year,
                fobAmount: period.fobAmount.toString(),
                cifAmount: period.cifAmount.toString(),
                reconstruction: true,
              },
            },
          });

          const line = await tx.purchaseOrderLine.create({
            data: {
              orderId: order.id,
              itemId: item.id,
              quantity: qty,
              unitCost,
              lineTotal,
              transactionUomId: uomId ?? undefined,
              baseQuantity: qty,
              baseUomId: uomId ?? item.baseUomId ?? undefined,
              conversionFactor: new Prisma.Decimal(1),
              conversionTrace: { path: 'cadeg_reconstruction' },
              receivedBaseQuantity: qty,
              landedCostAmount: lineTotal,
            },
          });

          const receipt = await tx.purchaseReceipt.create({
            data: {
              tenantId,
              purchaseOrderId: order.id,
              warehouseId: warehouse.id,
              zoneId: zone.id,
            },
          });

          const lotNumber = `${orderNumber}-L1`.slice(0, 40);
          const lot = await tx.inventoryLot.create({
            data: {
              tenantId,
              itemId: item.id,
              lotNumber,
              warehouseId: warehouse.id,
              zoneId: zone.id,
              initialQuantityKg: qty,
              quantityOnHandKg: qty,
              receivedDate: orderDate,
              status: ProduceLotStatus.AVAILABLE,
            },
          });

          const valueEntry = await tx.inventoryValueEntry.create({
            data: {
              tenantId,
              itemId: item.id,
              lotId: lot.id,
              entryType: 'PURCHASE_RECEIVE',
              quantity: qty,
              costAmount: lineTotal,
              documentType: 'PURCHASE_RECEIPT_LINE',
              documentId: receipt.id,
            },
          });

          await tx.itemLedgerEntry.create({
            data: {
              tenantId,
              itemId: item.id,
              quantity: qty,
              baseQuantity: qty,
              transactionUomId: uomId ?? undefined,
              baseUomId: uomId ?? item.baseUomId ?? undefined,
              conversionFactor: new Prisma.Decimal(1),
              conversionTrace: { path: 'cadeg_reconstruction' },
              lotId: lot.id,
              warehouseId: warehouse.id,
              zoneId: zone.id,
              valueEntryId: valueEntry.id,
              entryType: 'PURCHASE_RECEIVE',
              documentType: 'PURCHASE_ORDER_LINE',
              documentId: line.id,
              postingDate: orderDate,
            },
          });

          await tx.purchaseReceiptLine.create({
            data: {
              receiptId: receipt.id,
              purchaseOrderLineId: line.id,
              transactionQuantity: qty,
              baseQuantity: qty,
              lotId: lot.id,
            },
          });
        });

        existingNumbers.add(orderNumber);
        result.ordersCreated++;
        result.linesReceived++;
      }
    }

    this.logger.log(
      `CADEG purchases import tenant=${tenantId} created=${result.ordersCreated} skipped=${result.ordersSkipped}`,
    );
    return result;
  }

  async postSalesInventory(
    tenantId: string,
    options?: { dryRun?: boolean },
  ): Promise<CadegPostSalesInventoryResult> {
    const { warehouse, zone } = await this.ensureDefaultWarehouse(tenantId);

    const orders = await this.prisma.salesOrder.findMany({
      where: { tenantId, status: DocumentStatus.POSTED },
      include: {
        lines: {
          include: { item: true },
        },
      },
      orderBy: { orderDate: 'asc' },
    });

    const result: CadegPostSalesInventoryResult = {
      ordersProcessed: 0,
      linesPosted: 0,
      linesSkipped: 0,
      exceptions: [],
    };

    for (const order of orders) {
      let orderTouched = false;
      for (const line of order.lines) {
        const existing = await this.prisma.itemLedgerEntry.findFirst({
          where: {
            tenantId,
            documentType: 'SALES_ORDER_LINE',
            documentId: line.id,
            entryType: 'SALES_SHIPMENT',
          },
        });
        if (existing) {
          result.linesSkipped++;
          continue;
        }

        const qty = line.baseQuantity ?? line.quantity;
        if (qty.lte(0)) continue;

        if (options?.dryRun) {
          result.linesPosted++;
          orderTouched = true;
          continue;
        }

        try {
          await this.prisma.itemLedgerEntry.create({
            data: {
              tenantId,
              itemId: line.itemId,
              quantity: qty.neg(),
              baseQuantity: qty.neg(),
              transactionUomId: line.transactionUomId ?? undefined,
              baseUomId: line.baseUomId ?? undefined,
              conversionFactor: line.conversionFactor ?? new Prisma.Decimal(1),
              conversionTrace: line.conversionTrace ?? { path: 'cadeg_sales_history' },
              warehouseId: warehouse.id,
              zoneId: zone.id,
              entryType: 'SALES_SHIPMENT',
              documentType: 'SALES_ORDER_LINE',
              documentId: line.id,
              postingDate: order.orderDate,
            },
          });
          result.linesPosted++;
          orderTouched = true;
        } catch (err) {
          result.exceptions.push(
            `${order.number} line ${line.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
      if (orderTouched) result.ordersProcessed++;
    }

    this.logger.log(
      `CADEG sales inventory tenant=${tenantId} linesPosted=${result.linesPosted} skipped=${result.linesSkipped}`,
    );
    return result;
  }
}
