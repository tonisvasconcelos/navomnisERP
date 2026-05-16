import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../tenant/tenant-access.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermissions } from '../../rbac/permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';

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
    return this.prisma.chartOfAccount.findMany({
      orderBy: { code: 'asc' },
      take: 500,
    });
  }

  @Get('summary')
  @ApiOperation({ summary: 'Resumo financeiro (stub)' })
  summary() {
    return {
      message: 'Módulo financeiro — endpoints contábeis em expansão.',
      receivablesOpen: 0,
      payablesOpen: 0,
    };
  }
}
