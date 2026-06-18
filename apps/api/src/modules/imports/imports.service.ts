import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatus, ImportBatchStatus, ImportRowStatus, PartyKind, Prisma } from '@prisma/client';
import { Job, Queue } from 'bullmq';
import { legacyAliasToUomCode } from '../cadeg/cadeg-legacy-uom.map';
import { PrismaService } from '../../prisma/prisma.service';
import { decodeCsvBuffer, parseSemicolonCsv, salesRowIdempotencyKey } from './csv-parser.util';
import {
  csvField,
  mapSalesCsvHeader,
  parseBrDecimalOrZero,
  salesOrderNumberFromNf,
} from './legacy-csv-header.mapper';

export const IMPORTS_QUEUE = 'imports';

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(IMPORTS_QUEUE) private readonly queue: Queue,
  ) {}

  async createBatch(input: {
    tenantId: string;
    companyId: string;
    fileName: string;
    fileType: string;
    idempotencyKey: string;
    buffer: Buffer;
    encoding?: string;
  }) {
    const existing = await this.prisma.importBatch.findUnique({
      where: { tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey } },
    });
    if (existing) return existing;

    const batch = await this.prisma.importBatch.create({
      data: {
        tenantId: input.tenantId,
        companyId: input.companyId,
        fileName: input.fileName,
        fileType: input.fileType,
        idempotencyKey: input.idempotencyKey,
        status: ImportBatchStatus.UPLOADED,
      },
    });
    await this.queue.add('parse', { batchId: batch.id, bufferBase64: input.buffer.toString('base64'), encoding: input.encoding ?? 'windows-1252' });
    return batch;
  }

  getBatch(tenantId: string, batchId: string) {
    return this.prisma.importBatch.findFirst({
      where: { id: batchId, tenantId },
      include: { _count: { select: { rows: true } } },
    });
  }

  listRows(tenantId: string, batchId: string, status?: ImportRowStatus) {
    return this.prisma.importRow.findMany({
      where: { batchId, batch: { tenantId }, ...(status ? { status } : {}) },
      orderBy: { rowNumber: 'asc' },
      take: 500,
    });
  }

  async validateBatch(tenantId: string, batchId: string) {
    const batch = await this.getBatch(tenantId, batchId);
    if (!batch) throw new NotFoundException('Lote não encontrado.');
    await this.queue.add('validate', { batchId });
    return { queued: true };
  }

  async commitBatch(tenantId: string, batchId: string) {
    const batch = await this.prisma.importBatch.findFirst({ where: { id: batchId, tenantId } });
    if (!batch) throw new NotFoundException('Lote não encontrado.');
    if (batch.status !== ImportBatchStatus.READY_TO_COMMIT && batch.status !== ImportBatchStatus.COMMITTED) {
      return { committed: false, reason: 'Lote não está pronto para commit.' };
    }
    if (batch.status === ImportBatchStatus.COMMITTED) {
      return { committed: true, reason: 'already_committed' };
    }
    const result = await this.commitSalesRows(tenantId, batch.companyId, batchId);
    await this.prisma.importBatch.update({
      where: { id: batchId },
      data: { status: ImportBatchStatus.COMMITTED, committedAt: new Date() },
    });
    return { committed: true, ...result };
  }

  /** Parse + validate + commit sales CSV synchronously (CLI / provisioning). */
  async ingestSalesCsvSync(input: {
    tenantId: string;
    companyId: string;
    fileName: string;
    idempotencyKey: string;
    buffer: Buffer;
    encoding?: string;
    skipCommit?: boolean;
  }) {
    let batch = await this.prisma.importBatch.findUnique({
      where: { tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey } },
    });
    if (!batch) {
      batch = await this.prisma.importBatch.create({
        data: {
          tenantId: input.tenantId,
          companyId: input.companyId,
          fileName: input.fileName,
          fileType: 'SALES_CSV',
          idempotencyKey: input.idempotencyKey,
          status: ImportBatchStatus.UPLOADED,
        },
      });
      await this.parseBatchJob(
        batch.id,
        input.buffer.toString('base64'),
        input.encoding ?? 'windows-1252',
      );
    } else if (
      batch.status === ImportBatchStatus.UPLOADED ||
      batch.status === ImportBatchStatus.PARSING ||
      batch.status === ImportBatchStatus.VALIDATING
    ) {
      await this.parseBatchJob(
        batch.id,
        input.buffer.toString('base64'),
        input.encoding ?? 'windows-1252',
      );
    } else if (batch.status === ImportBatchStatus.READY_TO_COMMIT) {
      // continue to commit below
    }

    if (input.skipCommit || batch.status === ImportBatchStatus.COMMITTED) {
      return this.getBatch(input.tenantId, batch.id);
    }

    const fresh = await this.prisma.importBatch.findUniqueOrThrow({ where: { id: batch.id } });
    if (fresh.status === ImportBatchStatus.READY_TO_COMMIT) {
      return this.commitBatch(input.tenantId, batch.id);
    }
    return this.getBatch(input.tenantId, batch.id);
  }

  async validateAllRows(tenantId: string, batchId: string) {
    const lookup = await this.buildValidationLookup(tenantId);
    let pending = await this.prisma.importRow.count({
      where: { batchId, status: ImportRowStatus.PENDING },
    });
    while (pending > 0) {
      await this.validateBatchInternal(tenantId, batchId, lookup);
      pending = await this.prisma.importRow.count({
        where: { batchId, status: ImportRowStatus.PENDING },
      });
    }
    await this.prisma.importBatch.update({
      where: { id: batchId },
      data: { status: ImportBatchStatus.READY_TO_COMMIT },
    });
  }

  private async buildValidationLookup(tenantId: string) {
    const items = await this.prisma.item.findMany({
      where: { tenantId },
      select: { id: true, sku: true, baseUomId: true },
    });
    const itemBySku = new Map(items.filter((i) => i.sku).map((i) => [i.sku!, i]));
    const aliases = await this.prisma.unitOfMeasureAlias.findMany({
      where: { tenantId },
      select: { alias: true, uomId: true },
    });
    const aliasMap = new Map(aliases.map((a) => [a.alias.toLowerCase(), a.uomId]));
    const uoms = await this.prisma.unitOfMeasure.findMany({
      where: { tenantId },
      select: { id: true, code: true },
    });
    const uomByCode = new Map(uoms.map((u) => [u.code, u.id]));
    return { itemBySku, aliasMap, uomByCode };
  }

  async parseBatchJob(batchId: string, bufferBase64: string, encoding: string) {
    const batch = await this.prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } });
    const lookup = await this.buildValidationLookup(batch.tenantId);
    await this.prisma.importBatch.update({
      where: { id: batchId },
      data: { status: ImportBatchStatus.PARSING, rowCount: 0, errorCount: 0 },
    });
    await this.prisma.importRow.deleteMany({ where: { batchId } });

    const text = decodeCsvBuffer(Buffer.from(bufferBase64, 'base64'), encoding);
    const { rows } = parseSemicolonCsv(text);
    let errorCount = 0;
    const chunkSize = 1000;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const slice = rows.slice(i, i + chunkSize);
      const data = slice.map((row, idx) => {
        const errors: string[] = [];
        if (!row['Cod. Prod'] && !row['Produto']) errors.push('Produto ausente');
        if (!row['Qtd']) errors.push('Quantidade ausente');

        const sku = row['Cod. Prod']?.trim();
        const item = sku ? lookup.itemBySku.get(sku) : undefined;
        const alias = row['Unidade NF']?.trim();
        let resolvedUomId: string | undefined;
        if (alias) {
          resolvedUomId = lookup.aliasMap.get(alias.toLowerCase());
          if (!resolvedUomId) {
            const code = legacyAliasToUomCode(alias);
            if (code) resolvedUomId = lookup.uomByCode.get(code);
          }
        }
        if (!resolvedUomId && item?.baseUomId) {
          resolvedUomId = item.baseUomId;
        }
        if (!errors.length && !item) errors.push('Artigo não encontrado');

        const status = errors.length ? ImportRowStatus.ERROR : ImportRowStatus.VALID;
        if (errors.length) errorCount++;
        return {
          batchId,
          rowNumber: i + idx + 1,
          rawPayload: row,
          status,
          matchedItemId: item?.id,
          resolvedUomId,
          errors: errors.length ? errors : undefined,
          idempotencyKey: salesRowIdempotencyKey(row),
        };
      });
      await this.prisma.importRow.createMany({ data, skipDuplicates: true });
    }
    await this.prisma.importBatch.update({
      where: { id: batchId },
      data: {
        rowCount: rows.length,
        errorCount,
        status: errorCount === rows.length ? ImportBatchStatus.FAILED : ImportBatchStatus.READY_TO_COMMIT,
      },
    });
  }

  async validateBatchInternal(
    tenantId: string,
    batchId: string,
    lookup?: Awaited<ReturnType<ImportsService['buildValidationLookup']>>,
  ) {
    const maps = lookup ?? (await this.buildValidationLookup(tenantId));
    const rows = await this.prisma.importRow.findMany({
      where: { batchId, status: ImportRowStatus.PENDING },
      take: 5000,
    });
    if (!rows.length) {
      const batch = await this.prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } });
      if (batch.status !== ImportBatchStatus.COMMITTED) {
        await this.prisma.importBatch.update({
          where: { id: batchId },
          data: { status: ImportBatchStatus.READY_TO_COMMIT },
        });
      }
      return;
    }
    let errors = 0;
    for (const row of rows) {
      const payload = row.rawPayload as Record<string, string>;
      const sku = payload['Cod. Prod']?.trim();
      const item = sku ? maps.itemBySku.get(sku) : undefined;
      const alias = payload['Unidade NF']?.trim();
      let resolvedUomId: string | undefined;
      if (alias) {
        resolvedUomId = maps.aliasMap.get(alias.toLowerCase());
        if (!resolvedUomId) {
          const code = legacyAliasToUomCode(alias);
          if (code) resolvedUomId = maps.uomByCode.get(code);
        }
      }
      if (!resolvedUomId && item?.baseUomId) {
        resolvedUomId = item.baseUomId;
      }
      const rowErrors: string[] = [];
      if (!item) rowErrors.push('Artigo não encontrado');
      const status = rowErrors.length ? ImportRowStatus.ERROR : ImportRowStatus.VALID;
      if (rowErrors.length) errors++;
      await this.prisma.importRow.update({
        where: { id: row.id },
        data: {
          matchedItemId: item?.id,
          resolvedUomId,
          status,
          errors: rowErrors.length ? rowErrors : undefined,
        },
      });
    }
    const batch = await this.prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } });
    await this.prisma.importBatch.update({
      where: { id: batchId },
      data: {
        errorCount: batch.errorCount + errors,
        status: ImportBatchStatus.VALIDATING,
      },
    });
  }

  private async commitSalesRows(tenantId: string, companyId: string, batchId: string) {
    const rows = await this.prisma.importRow.findMany({
      where: {
        batchId,
        status: ImportRowStatus.VALID,
        matchedItemId: { not: null },
      },
      orderBy: { rowNumber: 'asc' },
    });

    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const payload = row.rawPayload as Record<string, string>;
      const customerCode = csvField(payload, 'Cod. Cliente');
      const nf = csvField(payload, 'NF');
      const key = `${customerCode}::${nf}`;
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }

    let ordersCreated = 0;
    let linesCreated = 0;
    let skipped = 0;

    const customers = await this.prisma.party.findMany({
      where: { tenantId, kind: PartyKind.CUSTOMER },
      select: { id: true, taxId: true },
    });
    const customerByTaxId = new Map(
      customers.filter((c) => c.taxId).map((c) => [c.taxId!, c.id]),
    );
    const existingOrders = await this.prisma.salesOrder.findMany({
      where: { tenantId },
      select: { number: true },
    });
    const existingNumbers = new Set(existingOrders.map((o) => o.number));

    for (const [, groupRows] of groups) {
      const first = groupRows[0]!;
      const payload = first.rawPayload as Record<string, string>;
      const customerCode = csvField(payload, 'Cod. Cliente');
      const nf = csvField(payload, 'NF').replace(/\//g, '').trim();
      if (!customerCode || !nf) {
        skipped += groupRows.length;
        continue;
      }

      const customerId = customerByTaxId.get(customerCode);
      if (!customerId) {
        skipped += groupRows.length;
        continue;
      }

      const orderNumber = salesOrderNumberFromNf(nf);
      if (existingNumbers.has(orderNumber)) {
        await this.prisma.importRow.updateMany({
          where: { id: { in: groupRows.map((r) => r.id) } },
          data: { status: ImportRowStatus.COMMITTED },
        });
        skipped += groupRows.length;
        continue;
      }

      const header = mapSalesCsvHeader(payload);
      let totalAmount = new Prisma.Decimal(0);
      const lineData: Prisma.SalesOrderLineCreateManyInput[] = [];

      for (const row of groupRows) {
        const p = row.rawPayload as Record<string, string>;
        const qty = parseBrDecimalOrZero(csvField(p, 'Qtd'));
        const unitPrice = parseBrDecimalOrZero(csvField(p, 'Valor Venda'));
        const lineTotal = parseBrDecimalOrZero(csvField(p, 'Total Prod'));
        if (qty.lte(0)) continue;
        totalAmount = totalAmount.add(lineTotal.gt(0) ? lineTotal : qty.mul(unitPrice));
        lineData.push({
          orderId: '',
          itemId: row.matchedItemId!,
          quantity: qty,
          unitPrice,
          lineTotal: lineTotal.gt(0) ? lineTotal : qty.mul(unitPrice),
          transactionUomId: row.resolvedUomId ?? undefined,
          baseUomId: row.resolvedUomId ?? undefined,
          baseQuantity: qty,
          conversionFactor: new Prisma.Decimal(1),
        });
      }

      if (!lineData.length) {
        skipped += groupRows.length;
        continue;
      }

      await this.prisma.$transaction(async (tx) => {
        const order = await tx.salesOrder.create({
          data: {
            tenantId,
            companyId,
            customerId,
            number: orderNumber,
            status: DocumentStatus.POSTED,
            totalAmount,
            ...header,
          },
        });
        await tx.salesOrderLine.createMany({
          data: lineData.map((l) => ({ ...l, orderId: order.id })),
        });
        await tx.importRow.updateMany({
          where: { id: { in: groupRows.map((r) => r.id) } },
          data: { status: ImportRowStatus.COMMITTED },
        });
      });

      existingNumbers.add(orderNumber);
      ordersCreated++;
      linesCreated += lineData.length;
    }

    return { ordersCreated, linesCreated, skipped, invoiceGroups: groups.size };
  }
}

@Processor(IMPORTS_QUEUE)
export class ImportsProcessor extends WorkerHost {
  constructor(private readonly imports: ImportsService) {
    super();
  }

  async process(job: Job<{ batchId: string; bufferBase64?: string; encoding?: string }>) {
    if (job.name === 'parse' && job.data.bufferBase64) {
      await this.imports.parseBatchJob(job.data.batchId, job.data.bufferBase64, job.data.encoding ?? 'windows-1252');
    } else if (job.name === 'validate') {
      const batch = await this.imports.getBatch('', job.data.batchId);
      if (batch) await this.imports.validateBatchInternal(batch.tenantId, job.data.batchId);
    }
  }
}
