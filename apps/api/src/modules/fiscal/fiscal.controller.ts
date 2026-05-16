import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BrazilianTaxKind } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../tenant/tenant-access.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermissions } from '../../rbac/permissions.decorator';
import {
  CreateBranchDto,
  CreateCompanyFiscalProfileDto,
  CreateEmployeeDto,
  CreateItemFiscalTemplateDto,
  CreatePartyFiscalProfileDto,
  CreateServiceFiscalTemplateDto,
  FiscalRegisterValidationDto,
} from './dto/fiscal-master-data.dto';
import { TaxPreviewDto } from './dto/tax-preview.dto';
import { FiscalService } from './fiscal.service';

@ApiTags('fiscal')
@ApiBearerAuth()
@Controller({ path: 'fiscal', version: '1' })
@UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
export class FiscalController {
  constructor(private readonly fiscal: FiscalService) {}

  @Get('setup/summary')
  @RequirePermissions('fiscal.read')
  @ApiOperation({ summary: 'Resumo da parametrização fiscal brasileira do tenant' })
  setupSummary() {
    return this.fiscal.setupSummary();
  }

  @Get('master-data/summary')
  @RequirePermissions('fiscal.read')
  @ApiOperation({ summary: 'Resumo dos cadastros mestres fiscais brasileiros' })
  masterDataSummary() {
    return this.fiscal.masterDataSummary();
  }

  @Get('item-templates')
  @RequirePermissions('fiscal.read')
  @ApiOperation({ summary: 'Modelos fiscais de item com classificaÃ§Ã£o tributÃ¡ria' })
  itemTemplates() {
    return this.fiscal.listItemTemplates();
  }

  @Post('item-templates')
  @RequirePermissions('fiscal.write')
  @ApiOperation({ summary: 'Cria modelo fiscal de item parametrizado' })
  createItemTemplate(@Body() dto: CreateItemFiscalTemplateDto) {
    return this.fiscal.createItemTemplate(dto);
  }

  @Get('service-templates')
  @RequirePermissions('fiscal.read')
  @ApiOperation({ summary: 'Modelos fiscais de serviÃ§o com ISS e retenÃ§Ãµes' })
  serviceTemplates() {
    return this.fiscal.listServiceTemplates();
  }

  @Post('service-templates')
  @RequirePermissions('fiscal.write')
  @ApiOperation({ summary: 'Cria modelo fiscal de serviÃ§o parametrizado' })
  createServiceTemplate(@Body() dto: CreateServiceFiscalTemplateDto) {
    return this.fiscal.createServiceTemplate(dto);
  }

  @Get('company-profiles')
  @RequirePermissions('fiscal.read')
  @ApiOperation({ summary: 'Perfis fiscais de empresas' })
  companyProfiles() {
    return this.fiscal.listCompanyProfiles();
  }

  @Post('company-profiles')
  @RequirePermissions('fiscal.write')
  @ApiOperation({ summary: 'Cria perfil fiscal de empresa' })
  createCompanyProfile(@Body() dto: CreateCompanyFiscalProfileDto) {
    return this.fiscal.createCompanyProfile(dto);
  }

  @Get('branches')
  @RequirePermissions('fiscal.read')
  @ApiOperation({ summary: 'Filiais fiscais e inscriÃ§Ãµes locais' })
  branches() {
    return this.fiscal.listBranches();
  }

  @Post('branches')
  @RequirePermissions('fiscal.write')
  @ApiOperation({ summary: 'Cria filial fiscal' })
  createBranch(@Body() dto: CreateBranchDto) {
    return this.fiscal.createBranch(dto);
  }

  @Get('employees')
  @RequirePermissions('fiscal.read')
  @ApiOperation({ summary: 'Cadastros de colaboradores para base fiscal trabalhista' })
  employees() {
    return this.fiscal.listEmployees();
  }

  @Post('employees')
  @RequirePermissions('fiscal.write')
  @ApiOperation({ summary: 'Cria cadastro fiscal de colaborador' })
  createEmployee(@Body() dto: CreateEmployeeDto) {
    return this.fiscal.createEmployee(dto);
  }

  @Get('party-profiles')
  @RequirePermissions('fiscal.read')
  @ApiOperation({ summary: 'Perfis fiscais de clientes e fornecedores' })
  partyProfiles() {
    return this.fiscal.listPartyProfiles();
  }

  @Post('party-profiles')
  @RequirePermissions('fiscal.write')
  @ApiOperation({ summary: 'Cria perfil fiscal de cliente ou fornecedor' })
  createPartyProfile(@Body() dto: CreatePartyFiscalProfileDto) {
    return this.fiscal.createPartyProfile(dto);
  }

  @Post('validate-register')
  @RequirePermissions('fiscal.read')
  @ApiOperation({ summary: 'Valida campos fiscais brasileiros bÃ¡sicos' })
  validateRegister(@Body() dto: FiscalRegisterValidationDto) {
    return this.fiscal.validateRegister(dto);
  }

  @Get('tax-rules')
  @RequirePermissions('fiscal.read')
  @ApiOperation({ summary: 'Regras tributárias parametrizadas e datadas' })
  rules(@Query('taxKind') taxKind?: string) {
    if (taxKind && !Object.values(BrazilianTaxKind).includes(taxKind as BrazilianTaxKind)) {
      throw new BadRequestException('Tributo inválido.');
    }
    return this.fiscal.listRules(taxKind as BrazilianTaxKind | undefined);
  }

  @Post('tax-preview')
  @RequirePermissions('fiscal.read')
  @ApiOperation({ summary: 'Prévia parametrizada de cálculo tributário' })
  preview(@Body() dto: TaxPreviewDto) {
    return this.fiscal.previewTaxes(dto);
  }
}
