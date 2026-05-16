import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantContext } from '../../tenant/tenant-storage';
import type { PostingPreviewDto } from './dto/posting-preview.dto';

@Injectable()
export class PostingService {
  constructor(private readonly prisma: PrismaService) {}

  private ctx() {
    const ctx = getTenantContext();
    if (!ctx) {
      throw new ForbiddenException('Contexto de tenant ausente.');
    }
    return ctx;
  }

  async preview(dto: PostingPreviewDto) {
    const { tenantId } = this.ctx();
    if (dto.sourceType !== 'SALES_ORDER') {
      throw new BadRequestException('Prévia inicial suporta sourceType SALES_ORDER.');
    }
    const order = await this.prisma.salesOrder.findFirst({
      where: { tenantId, id: dto.sourceId },
      include: { customer: true, company: true, lines: { include: { item: true } } },
    });
    if (!order) {
      throw new BadRequestException('Pedido de venda não encontrado.');
    }
    const postingDate = dto.postingDate ? new Date(dto.postingDate) : new Date();
    const total = new Prisma.Decimal(order.totalAmount);
    const lines = [
      {
        lineNumber: 10000,
        ledger: 'CUSTOMER',
        side: 'DEBIT',
        accountNo: order.customer.taxId ?? order.customer.name,
        amount: total.toString(),
        description: `Cliente - ${order.number}`,
      },
      {
        lineNumber: 20000,
        ledger: 'GENERAL',
        side: 'CREDIT',
        accountNo: 'REVENUE_FROM_POSTING_SETUP',
        amount: total.toString(),
        description: `Receita - ${order.number}`,
      },
    ];
    return {
      sourceType: dto.sourceType,
      sourceId: dto.sourceId,
      postingDate: postingDate.toISOString(),
      company: { id: order.companyId, name: order.company.name },
      document: { number: order.number, status: order.status },
      totals: {
        debit: total.toString(),
        credit: total.toString(),
        balanced: true,
      },
      lines,
      validationMessages: [
        'Prévia contábil estrutural: contas definitivas devem vir de PostingSetup/TaxPostingSetup.',
        order.lines.length ? null : 'Pedido sem linhas.',
      ].filter(Boolean),
    };
  }
}
