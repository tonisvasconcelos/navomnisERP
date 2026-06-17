import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../tenant/tenant-access.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermissions } from '../../rbac/permissions.decorator';
import { DashboardsService } from './dashboards.service';

@ApiTags('dashboards')
@ApiBearerAuth()
@Controller({ path: 'dashboards', version: '1' })
@UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
export class DashboardsController {
  constructor(private readonly dashboards: DashboardsService) {}

  @Get('operations/summary')
  @RequirePermissions('finance.read')
  summary() {
    return this.dashboards.operationsSummary();
  }

  @Get('margin/by-dimension')
  @RequirePermissions('finance.read')
  margin(@Query('dim') dim = 'product') {
    return this.dashboards.marginByDimension(dim);
  }

  @Get('purchases/variance')
  @RequirePermissions('purchases.read')
  variance() {
    return this.dashboards.purchaseVariance();
  }

  @Get('inventory/fefo-risk')
  @RequirePermissions('inventory.read')
  fefoRisk(@Query('days') days?: string) {
    return this.dashboards.fefoRisk(days ? Number(days) : 7);
  }

  @Get('inventory/shrinkage')
  @RequirePermissions('inventory.read')
  shrinkage() {
    return this.dashboards.shrinkage();
  }

  @Get('inventory/aging')
  @RequirePermissions('inventory.read')
  aging() {
    return this.dashboards.lotAging();
  }

  @Get('receiving/status')
  @RequirePermissions('purchases.read')
  receiving() {
    return this.dashboards.receivingStatus();
  }

  @Get('exceptions/uom')
  @RequirePermissions('master.read')
  uomExceptions() {
    return this.dashboards.uomExceptions();
  }
}
