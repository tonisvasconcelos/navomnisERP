import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../tenant/tenant-access.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermissions } from '../../rbac/permissions.decorator';
import { CreateItemConversionDto, CreateUomAliasDto, CreateUomDto, ConvertQuantityDto } from './dto/uom.dto';
import { UomConversionService } from './uom-conversion.service';
import { UomService } from './uom.service';

@ApiTags('uom')
@ApiBearerAuth()
@Controller({ path: 'uom', version: '1' })
@UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
export class UomController {
  constructor(
    private readonly uom: UomService,
    private readonly conversion: UomConversionService,
  ) {}

  @Get('units')
  @RequirePermissions('master.read')
  listUnits() {
    return this.uom.listUnits();
  }

  @Post('units')
  @RequirePermissions('master.write')
  createUnit(@Body() dto: CreateUomDto) {
    return this.uom.createUnit(dto);
  }

  @Patch('units/:id')
  @RequirePermissions('master.write')
  updateUnit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<CreateUomDto>) {
    return this.uom.updateUnit(id, dto);
  }

  @Get('aliases')
  @RequirePermissions('master.read')
  listAliases() {
    return this.uom.listAliases();
  }

  @Post('aliases')
  @RequirePermissions('master.write')
  createAlias(@Body() dto: CreateUomAliasDto) {
    return this.uom.createAlias(dto);
  }

  @Get('items/:itemId/conversions')
  @RequirePermissions('master.read')
  listConversions(@Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.uom.listItemConversions(itemId);
  }

  @Post('items/:itemId/conversions')
  @RequirePermissions('master.write')
  createConversion(@Param('itemId', ParseUUIDPipe) itemId: string, @Body() dto: CreateItemConversionDto) {
    return this.uom.createItemConversion(itemId, dto);
  }

  @Delete('items/:itemId/conversions/:conversionId')
  @RequirePermissions('master.write')
  deleteConversion(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Param('conversionId', ParseUUIDPipe) conversionId: string,
  ) {
    return this.uom.deleteItemConversion(itemId, conversionId);
  }

  @Post('convert')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Pré-visualizar conversão de quantidade' })
  convert(@Body() dto: ConvertQuantityDto) {
    return this.conversion.convertItemQuantity(dto);
  }

  @Get('exceptions')
  @RequirePermissions('master.read')
  listExceptions() {
    return this.uom.listExceptions();
  }
}
