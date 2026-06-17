import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import {
  AddPurchaseOrderLineDto,
  CreatePurchaseOrderDto,
} from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { UpdatePurchaseOrderLineDto } from './dto/update-purchase-order-line.dto';
import { ApprovalActionDto } from '../approvals/dto/approval.dto';
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

  @Post('orders')
  @RequirePermissions('purchases.write')
  @ApiOperation({ summary: 'Criar pedido de compra (rascunho)' })
  createOrder(@Body() dto: CreatePurchaseOrderDto, @Req() req: Request) {
    return this.purchases.createOrder(dto, req);
  }

  @Get('orders/:id')
  @RequirePermissions('purchases.read')
  @ApiOperation({ summary: 'Obter pedido de compra' })
  orderById(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchases.getOrder(id);
  }

  @Post('orders/:id/lines')
  @RequirePermissions('purchases.write')
  @ApiOperation({ summary: 'Adicionar linha ao pedido' })
  addLine(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddPurchaseOrderLineDto,
    @Req() req: Request,
  ) {
    return this.purchases.addLine(id, dto, req);
  }

  @Patch('orders/:id/lines/:lineId')
  @RequirePermissions('purchases.write')
  @ApiOperation({ summary: 'Atualizar linha (rascunho)' })
  updateLine(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: UpdatePurchaseOrderLineDto,
    @Req() req: Request,
  ) {
    return this.purchases.updateLine(id, lineId, dto, req);
  }

  @Delete('orders/:id/lines/:lineId')
  @RequirePermissions('purchases.write')
  @ApiOperation({ summary: 'Remover linha (rascunho)' })
  removeLine(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Req() req: Request,
  ) {
    return this.purchases.removeLine(id, lineId, req);
  }

  @Post('orders/:id/submit-approval')
  @RequirePermissions('purchases.write')
  @ApiOperation({ summary: 'Submeter pedido para aprovação' })
  submitApproval(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.purchases.submitForApproval(id, req);
  }

  @Post('orders/:id/approve')
  @RequirePermissions('purchases.write')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApprovalActionDto,
    @Req() req: Request,
  ) {
    return this.purchases.approveOrder(id, dto.comment, req);
  }

  @Post('orders/:id/reject')
  @RequirePermissions('purchases.write')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApprovalActionDto,
    @Req() req: Request,
  ) {
    return this.purchases.rejectOrder(id, dto.comment, req);
  }

  @Post('orders/:id/request-changes')
  @RequirePermissions('purchases.write')
  requestChanges(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApprovalActionDto,
    @Req() req: Request,
  ) {
    return this.purchases.requestChanges(id, dto.comment, req);
  }

  @Post('orders/:id/release')
  @RequirePermissions('purchases.write')
  @ApiOperation({ summary: 'Libertar pedido (rascunho → aberto)' })
  release(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.purchases.releaseOrder(id, req);
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
