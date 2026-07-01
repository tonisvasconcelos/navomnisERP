import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../tenant/tenant-access.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermissions } from '../../rbac/permissions.decorator';
import { CreateItemDto } from './dto/create-item.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@Controller({ path: 'inventory', version: '1' })
@UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('items')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Listar itens' })
  items() {
    return this.inventory.listItems();
  }

  @Get('balances')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Saldo por artigo (soma do ledger)' })
  balances() {
    return this.inventory.balances();
  }

  @Get('items/:id')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Detalhe do artigo (estoque, UOM, lotes)' })
  getItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventory.getItemDetail(id);
  }

  @Post('items')
  @RequirePermissions('master.write')
  @ApiOperation({ summary: 'Criar artigo' })
  createItem(@Body() dto: CreateItemDto, @Req() req: Request) {
    return this.inventory.createItem(dto, req);
  }

  @Get('ledger')
  @RequirePermissions('inventory.read')
  @ApiOperation({ summary: 'Últimos lançamentos de estoque' })
  ledger() {
    return this.inventory.ledger();
  }
}
