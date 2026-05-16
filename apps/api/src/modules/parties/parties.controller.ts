import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../tenant/tenant-access.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermissions } from '../../rbac/permissions.decorator';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { PartiesService } from './parties.service';

@ApiTags('parties')
@ApiBearerAuth()
@Controller({ path: 'parties', version: '1' })
@UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
export class PartiesController {
  constructor(private readonly parties: PartiesService) {}

  @Get('companies')
  @RequirePermissions('master.read')
  @ApiOperation({ summary: 'Listar empresas do tenant' })
  companies() {
    return this.parties.listCompanies();
  }

  @Get('customers')
  @RequirePermissions('master.read')
  @ApiOperation({ summary: 'Listar clientes' })
  customers() {
    return this.parties.listCustomers();
  }

  @Post('customers')
  @RequirePermissions('master.write')
  @ApiOperation({ summary: 'Criar cliente' })
  createCustomer(@Body() dto: CreateCustomerDto, @Req() req: Request) {
    return this.parties.createCustomer(dto, req);
  }
}
