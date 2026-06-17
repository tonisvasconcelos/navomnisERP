import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantStatus } from '@prisma/client';
import { ProvisionCadegDto } from '../../modules/cadeg/dto/provision-cadeg.dto';
import { CadegMasterDataService } from '../../modules/cadeg/cadeg-master-data.service';
import { PlatformPermissions } from '../decorators/platform-permissions.decorator';
import { PlatformAuditInterceptor } from '../interceptors/platform-audit.interceptor';
import { PlatformContextInterceptor } from '../interceptors/platform-context.interceptor';
import { PlatformJwtGuard } from '../auth/guards/platform-jwt.guard';
import { PlatformPermissionsGuard } from '../rbac/platform-permissions.guard';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { PlatformTenantsService } from './platform-tenants.service';

@ApiTags('platform-tenants')
@ApiBearerAuth()
@Controller({ path: 'platform/tenants', version: '1' })
@UseGuards(PlatformJwtGuard, PlatformPermissionsGuard)
@UseInterceptors(PlatformContextInterceptor, PlatformAuditInterceptor)
export class PlatformTenantsController {
  constructor(
    private readonly tenants: PlatformTenantsService,
    private readonly cadeg: CadegMasterDataService,
  ) {}

  @Get()
  @PlatformPermissions('platform.tenants.read')
  @ApiOperation({ summary: 'Listar tenants' })
  async list(
    @Query('search') search?: string,
    @Query('status') status?: TenantStatus,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const [items, total] = await this.tenants.list({
      search,
      status,
      skip: skip ? Number(skip) : 0,
      take: take ? Number(take) : 50,
    });
    return { items, total };
  }

  @Get(':id')
  @PlatformPermissions('platform.tenants.read')
  get(@Param('id') id: string) {
    return this.tenants.get(id);
  }

  @Post()
  @PlatformPermissions('platform.tenants.write')
  create(@Body() dto: CreateTenantDto) {
    return this.tenants.create(dto);
  }

  @Patch(':id')
  @PlatformPermissions('platform.tenants.write')
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenants.update(id, dto);
  }

  @Post(':id/activate')
  @PlatformPermissions('platform.tenants.lifecycle')
  activate(@Param('id') id: string) {
    return this.tenants.setStatus(id, TenantStatus.ACTIVE);
  }

  @Post(':id/suspend')
  @PlatformPermissions('platform.tenants.lifecycle')
  suspend(@Param('id') id: string) {
    return this.tenants.setStatus(id, TenantStatus.SUSPENDED);
  }

  @Post(':id/block')
  @PlatformPermissions('platform.tenants.lifecycle')
  block(@Param('id') id: string) {
    return this.tenants.setStatus(id, TenantStatus.BLOCKED);
  }

  @Delete(':id')
  @PlatformPermissions('platform.tenants.lifecycle')
  softDelete(@Param('id') id: string) {
    return this.tenants.softDelete(id);
  }

  @Post(':id/provision/cadeg')
  @PlatformPermissions('platform.tenants.write')
  @ApiOperation({ summary: 'Importar master data CADEG (CSV legado) para o tenant' })
  provisionCadeg(@Param('id') id: string, @Body() dto: ProvisionCadegDto) {
    return this.cadeg.provisionTenant(id, {
      dataDir: dto.dataDir,
      stageTransactions: dto.stageTransactions,
    });
  }

  @Post(':id/restore')
  @PlatformPermissions('platform.tenants.lifecycle')
  restore(@Param('id') id: string) {
    return this.tenants.restore(id);
  }
}
