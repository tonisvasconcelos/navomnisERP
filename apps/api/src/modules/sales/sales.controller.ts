import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../tenant/tenant-access.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermissions } from '../../rbac/permissions.decorator';
import { AddSalesOrderLineDto, CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { UpdateSalesOrderLineDto } from './dto/update-sales-order-line.dto';
import { ListDocumentOrdersQueryDto } from '../../common/dto/list-document-orders-query.dto';
import { SalesService } from './sales.service';

@ApiTags('sales')
@ApiBearerAuth()
@Controller({ path: 'sales', version: '1' })
@UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get('orders')
  @RequirePermissions('sales.read')
  @ApiOperation({ summary: 'Listar pedidos de venda' })
  orders(@Query() query: ListDocumentOrdersQueryDto) {
    return this.sales.listOrders(query);
  }

  @Post('orders')
  @RequirePermissions('sales.write')
  @ApiOperation({ summary: 'Criar pedido de venda (rascunho)' })
  createOrder(@Body() dto: CreateSalesOrderDto, @Req() req: Request) {
    return this.sales.createOrder(dto, req);
  }

  @Get('orders/:id')
  @RequirePermissions('sales.read')
  @ApiOperation({ summary: 'Obter pedido por ID' })
  orderById(@Param('id', ParseUUIDPipe) id: string) {
    return this.sales.getOrder(id);
  }

  @Post('orders/:id/lines')
  @RequirePermissions('sales.write')
  @ApiOperation({ summary: 'Adicionar linha ao pedido' })
  addLine(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddSalesOrderLineDto,
    @Req() req: Request,
  ) {
    return this.sales.addLine(id, dto, req);
  }

  @Patch('orders/:id/lines/:lineId')
  @RequirePermissions('sales.write')
  @ApiOperation({ summary: 'Atualizar linha (rascunho)' })
  updateLine(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: UpdateSalesOrderLineDto,
    @Req() req: Request,
  ) {
    return this.sales.updateLine(id, lineId, dto, req);
  }

  @Delete('orders/:id/lines/:lineId')
  @RequirePermissions('sales.write')
  @ApiOperation({ summary: 'Remover linha (rascunho)' })
  removeLine(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Req() req: Request,
  ) {
    return this.sales.removeLine(id, lineId, req);
  }

  @Post('orders/:id/release')
  @RequirePermissions('sales.write')
  @ApiOperation({ summary: 'Libertar pedido (rascunho → aberto) e movimentar stock' })
  release(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.sales.releaseOrder(id, req);
  }
}
