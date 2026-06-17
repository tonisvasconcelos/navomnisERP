import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ImportBatchStatus, ImportRowStatus } from '@prisma/client';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { decodeCsvBuffer, parseSemicolonCsv, salesRowIdempotencyKey } from './csv-parser.util';

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
    if (batch.status !== ImportBatchStatus.READY_TO_COMMIT) {
      return { committed: false, reason: 'Lote não está pronto para commit.' };
    }
    await this.prisma.importBatch.update({
      where: { id: batchId },
      data: { status: ImportBatchStatus.COMMITTED, committedAt: new Date() },
    });
    return { committed: true };
  }

  async parseBatchJob(batchId: string, bufferBase64: string, encoding: string) {
    const batch = await this.prisma.importBatch.findUniqueOrThrow({ where: { id: batchId } });
    await this.prisma.importBatch.update({
      where: { id: batchId },
      data: { status: ImportBatchStatus.PARSING },
    });
    const text = decodeCsvBuffer(Buffer.from(bufferBase64, 'base64'), encoding);
    const { rows } = parseSemicolonCsv(text);
    let errorCount = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const errors: string[] = [];
      if (!row['Cod. Prod'] && !row['Produto']) errors.push('Produto ausente');
      if (!row['Qtd']) errors.push('Quantidade ausente');
      const status = errors.length ? ImportRowStatus.ERROR : ImportRowStatus.PENDING;
      if (errors.length) errorCount++;
      await this.prisma.importRow.upsert({
        where: { batchId_idempotencyKey: { batchId, idempotencyKey: salesRowIdempotencyKey(row) } },
        create: {
          batchId,
          rowNumber: i + 1,
          rawPayload: row,
          status,
          errors: errors.length ? errors : undefined,
          idempotencyKey: salesRowIdempotencyKey(row),
        },
        update: { rawPayload: row, status, errors: errors.length ? errors : undefined },
      });
    }
    await this.prisma.importBatch.update({
      where: { id: batchId },
      data: {
        rowCount: rows.length,
        errorCount,
        status: errorCount === rows.length ? ImportBatchStatus.FAILED : ImportBatchStatus.VALIDATING,
      },
    });
    await this.validateBatchInternal(batch.tenantId, batchId);
  }

  async validateBatchInternal(tenantId: string, batchId: string) {
    const rows = await this.prisma.importRow.findMany({
      where: { batchId, status: ImportRowStatus.PENDING },
      take: 1000,
    });
    let errors = 0;
    for (const row of rows) {
      const payload = row.rawPayload as Record<string, string>;
      const sku = payload['Cod. Prod']?.trim();
      const item = sku
        ? await this.prisma.item.findFirst({ where: { tenantId, sku } })
        : null;
      const alias = payload['Unidade NF']?.trim();
      let resolvedUomId: string | undefined;
      if (alias) {
        const uomAlias = await this.prisma.unitOfMeasureAlias.findFirst({
          where: { tenantId, alias: { equals: alias, mode: 'insensitive' } },
        });
        resolvedUomId = uomAlias?.uomId;
      }
      const rowErrors: string[] = [];
      if (!item) rowErrors.push('Artigo não encontrado');
      if (alias && !resolvedUomId) rowErrors.push('UOM não resolvida');
      const status = rowErrors.length ? ImportRowStatus.ERROR : ImportRowStatus.PENDING;
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
        status: ImportBatchStatus.READY_TO_COMMIT,
      },
    });
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
