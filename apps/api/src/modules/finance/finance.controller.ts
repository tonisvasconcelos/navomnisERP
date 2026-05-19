import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../tenant/tenant-access.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermissions } from '../../rbac/permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantContext } from '../../tenant/tenant-storage';

@ApiTags('finance')
@ApiBearerAuth()
@Controller({ path: 'finance', version: '1' })
@UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
@RequirePermissions('finance.read')
export class FinanceController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('chart-of-accounts')
  @ApiOperation({ summary: 'Listar plano de contas' })
  listCoa() {
    const ctx = getTenantContext();
    const tenantId = ctx?.tenantId;
    return this.prisma.chartOfAccount.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { code: 'asc' },
      take: 500,
    });
  }

  @Get('summary')
  @ApiOperation({ summary: 'Resumo financeiro' })
  async summary() {
    const ctx = getTenantContext();
    const tenantId = ctx?.tenantId ?? '';
    const chartOfAccountsCount = tenantId
      ? await this.prisma.chartOfAccount.count({ where: { tenantId } })
      : 0;

    return {
      message: 'Módulo financeiro — indicadores básicos; lançamentos GL fora de âmbito.',
      receivablesOpen: 0,
      payablesOpen: 0,
      chartOfAccountsCount,
      glPostingEnabled: false,
      limitsNote:
        'Sem lançamentos de razão geral nesta versão. Contas a receber/pagar permanecem em zero até integração AP/AR.',
    };
  }
}
