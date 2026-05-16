import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../tenant/tenant-access.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermissions } from '../../rbac/permissions.decorator';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { PurchasesService } from './purchases.service';

@ApiTags('purchases')
@ApiBearerAuth()
@Controller({ path: 'purchases', version: '1' })
@UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get('orders')
  @RequirePermissions('purchases.read')
  @ApiOperation({ summary: 'Listar pedidos de compra' })
  orders() {
    return this.purchases.listOrders();
  }

  @Get('orders/:id')
  @RequirePermissions('purchases.read')
  @ApiOperation({ summary: 'Obter pedido de compra' })
  orderById(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchases.getOrder(id);
  }

  @Post('orders/:id/receive')
  @RequirePermissions('purchases.write')
  @ApiOperation({ summary: 'Registar receção de stock (PO)' })
  receive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceivePurchaseOrderDto,
    @Req() req: Request,
  ) {
    return this.purchases.receiveOrder(id, dto, req);
  }
}
