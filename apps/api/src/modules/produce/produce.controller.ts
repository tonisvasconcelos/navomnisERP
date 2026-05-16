import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermissions } from '../../rbac/permissions.decorator';
import { TenantAccessGuard } from '../../tenant/tenant-access.guard';
import {
  CreateAgriculturalItemProfileDto,
  CreateDeliveryRouteDto,
  CreateInventoryLossEventDto,
  CreateInventoryLotDto,
  CreateLandedCostAllocationDto,
  CreatePackagingTypeDto,
  CreateQualityInspectionDto,
  CreateWarehouseDto,
  CreateWarehouseZoneDto,
} from './dto/produce.dto';
import { ProduceService } from './produce.service';

@ApiTags('produce')
@ApiBearerAuth()
@Controller({ path: 'produce', version: '1' })
@UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
export class ProduceController {
  constructor(private readonly produce: ProduceService) {}

  @Get('summary')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Resumo operacional hortifruti' })
  summary() {
    return this.produce.summary();
  }

  @Get('profiles')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Perfis hortifruti de itens' })
  profiles() {
    return this.produce.listProfiles();
  }

  @Post('profiles')
  @RequirePermissions('master.write')
  @ApiOperation({ summary: 'Cria perfil hortifruti para item' })
  createProfile(@Body() dto: CreateAgriculturalItemProfileDto) {
    return this.produce.createProfile(dto);
  }

  @Get('packaging')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Tipos de embalagem e tara' })
  packaging() {
    return this.produce.listPackaging();
  }

  @Post('packaging')
  @RequirePermissions('master.write')
  @ApiOperation({ summary: 'Cria embalagem operacional' })
  createPackaging(@Body() dto: CreatePackagingTypeDto) {
    return this.produce.createPackaging(dto);
  }

  @Get('warehouses')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Armazens e zonas' })
  warehouses() {
    return this.produce.listWarehouses();
  }

  @Post('warehouses')
  @RequirePermissions('master.write')
  @ApiOperation({ summary: 'Cria armazem' })
  createWarehouse(@Body() dto: CreateWarehouseDto) {
    return this.produce.createWarehouse(dto);
  }

  @Post('warehouse-zones')
  @RequirePermissions('master.write')
  @ApiOperation({ summary: 'Cria zona de armazem' })
  createWarehouseZone(@Body() dto: CreateWarehouseZoneDto) {
    return this.produce.createWarehouseZone(dto);
  }

  @Get('lots')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Lotes com validade, FEFO e qualidade' })
  lots() {
    return this.produce.listLots();
  }

  @Post('lots')
  @RequirePermissions('master.write')
  @ApiOperation({ summary: 'Recebe lote ponderado e cria movimento de estoque' })
  createLot(@Body() dto: CreateInventoryLotDto) {
    return this.produce.createLot(dto);
  }

  @Get('expiration-risk')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Lotes em risco de vencimento' })
  expirationRisk(@Query('days') days?: string) {
    return this.produce.expirationRisk(days ? Number(days) : 7);
  }

  @Get('quality-inspections')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Inspecoes de qualidade' })
  inspections() {
    return this.produce.listInspections();
  }

  @Post('quality-inspections')
  @RequirePermissions('master.write')
  @ApiOperation({ summary: 'Cria inspecao de qualidade' })
  createInspection(@Body() dto: CreateQualityInspectionDto) {
    return this.produce.createInspection(dto);
  }

  @Get('losses')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Perdas, quebras e avarias' })
  losses() {
    return this.produce.listLosses();
  }

  @Post('losses')
  @RequirePermissions('master.write')
  @ApiOperation({ summary: 'Registra perda e baixa saldo do lote' })
  createLoss(@Body() dto: CreateInventoryLossEventDto) {
    return this.produce.createLoss(dto);
  }

  @Get('landed-costs')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Alocacoes de custo de compra/frete' })
  landedCosts() {
    return this.produce.listLandedCosts();
  }

  @Post('landed-costs')
  @RequirePermissions('master.write')
  @ApiOperation({ summary: 'Cria alocacao de custo agregado' })
  createLandedCost(@Body() dto: CreateLandedCostAllocationDto) {
    return this.produce.createLandedCost(dto);
  }

  @Get('routes')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Rotas de entrega e expedicao' })
  routes() {
    return this.produce.listRoutes();
  }

  @Post('routes')
  @RequirePermissions('master.write')
  @ApiOperation({ summary: 'Cria rota de entrega' })
  createRoute(@Body() dto: CreateDeliveryRouteDto) {
    return this.produce.createRoute(dto);
  }
}
