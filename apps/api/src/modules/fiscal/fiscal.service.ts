import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { BrazilianFiscalRegime, BrazilianTaxKind, Prisma, TaxpayerType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantContext } from '../../tenant/tenant-storage';
import {
  CreateBranchDto,
  CreateCompanyFiscalProfileDto,
  CreateEmployeeDto,
  CreateItemFiscalTemplateDto,
  CreatePartyFiscalProfileDto,
  CreateServiceFiscalTemplateDto,
  FiscalRegisterValidationDto,
} from './dto/fiscal-master-data.dto';
import type { TaxPreviewDto } from './dto/tax-preview.dto';
import {
  hasValidCfopFormat,
  hasValidCstFormat,
  hasValidMunicipalityCodeFormat,
  hasValidNcmFormat,
  isValidCnpj,
  isValidCpf,
  onlyDigits,
} from './validators/brazilian-fiscal.validators';

@Injectable()
export class FiscalService {
  constructor(private readonly prisma: PrismaService) {}

  private ctx() {
    const ctx = getTenantContext();
    if (!ctx) {
      throw new ForbiddenException('Contexto de tenant ausente.');
    }
    return ctx;
  }

  async setupSummary() {
    const { tenantId } = this.ctx();
    const [
      jurisdictions,
      regimes,
      operationTypes,
      taxGroups,
      activeRules,
      productProfiles,
      partyProfiles,
      fiscalDocuments,
      postedTaxEntries,
    ] = await Promise.all([
      this.prisma.fiscalJurisdiction.count({ where: { tenantId } }),
      this.prisma.fiscalRegimeSetup.count({ where: { tenantId } }),
      this.prisma.fiscalOperationType.count({ where: { tenantId } }),
      this.prisma.taxGroup.count({ where: { tenantId } }),
      this.prisma.taxDeterminationRule.count({ where: { tenantId, isActive: true } }),
      this.prisma.productFiscalProfile.count({ where: { tenantId } }),
      this.prisma.partyFiscalProfile.count({ where: { tenantId } }),
      this.prisma.fiscalDocument.count({ where: { tenantId } }),
      this.prisma.taxLedgerEntry.count({ where: { tenantId } }),
    ]);

    const reformRules = await this.prisma.taxDeterminationRule.groupBy({
      by: ['taxKind'],
      where: {
        tenantId,
        taxKind: { in: [BrazilianTaxKind.IBS, BrazilianTaxKind.CBS, BrazilianTaxKind.IS] },
        isActive: true,
      },
      _count: { taxKind: true },
    });

    return {
      jurisdictions,
      regimes,
      operationTypes,
      taxGroups,
      activeRules,
      productProfiles,
      partyProfiles,
      fiscalDocuments,
      postedTaxEntries,
      reformTaxesConfigured: reformRules.map((row) => ({
        taxKind: row.taxKind,
        rules: row._count.taxKind,
      })),
      readinessWarnings: [
        jurisdictions ? null : 'Sem jurisdições fiscais cadastradas.',
        regimes ? null : 'Sem regime fiscal efetivo para empresas.',
        operationTypes ? null : 'Sem tipos de operação fiscal.',
        activeRules ? null : 'Sem regras tributárias ativas.',
      ].filter(Boolean),
    };
  }

  async masterDataSummary() {
    const { tenantId } = this.ctx();
    const [
      itemTemplates,
      serviceTemplates,
      companyProfiles,
      branches,
      branchProfiles,
      employees,
      employeeTaxProfiles,
      partyProfiles,
      productProfiles,
    ] = await Promise.all([
      this.prisma.itemFiscalTemplate.count({ where: { tenantId } }),
      this.prisma.serviceFiscalTemplate.count({ where: { tenantId } }),
      this.prisma.companyFiscalProfile.count({ where: { tenantId } }),
      this.prisma.branch.count({ where: { tenantId } }),
      this.prisma.branchFiscalProfile.count({ where: { tenantId } }),
      this.prisma.employee.count({ where: { tenantId } }),
      this.prisma.employeeTaxProfile.count({ where: { tenantId } }),
      this.prisma.partyFiscalProfile.count({ where: { tenantId } }),
      this.prisma.productFiscalProfile.count({ where: { tenantId } }),
    ]);

    return {
      itemTemplates,
      serviceTemplates,
      companyProfiles,
      branches,
      branchProfiles,
      employees,
      employeeTaxProfiles,
      partyProfiles,
      productProfiles,
      readinessWarnings: [
        itemTemplates ? null : 'Sem modelos fiscais de item para heranÃ§a de cadastro.',
        serviceTemplates ? null : 'Sem modelos fiscais de serviÃ§o para ISS/retenÃ§Ãµes.',
        companyProfiles ? null : 'Sem perfil fiscal completo da empresa.',
        branches ? null : 'Sem filiais fiscais para operaÃ§Ãµes estaduais/municipais.',
      ].filter(Boolean),
    };
  }

  listItemTemplates() {
    const { tenantId } = this.ctx();
    return this.prisma.itemFiscalTemplate.findMany({
      where: { tenantId },
      orderBy: [{ status: 'asc' }, { code: 'asc' }],
      take: 200,
      include: { taxGroup: true },
    });
  }

  createItemTemplate(dto: CreateItemFiscalTemplateDto) {
    const { tenantId } = this.ctx();
    const errors = this.validateRegister({ ncm: dto.ncm, cst: dto.icmsCst });
    if (errors.errors.length) {
      throw new BadRequestException(errors.errors.join(' '));
    }
    return this.prisma.itemFiscalTemplate.create({
      data: {
        tenantId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        status: dto.status,
        ncm: dto.ncm ? onlyDigits(dto.ncm) : undefined,
        cest: dto.cest ? onlyDigits(dto.cest) : undefined,
        productOrigin: dto.productOrigin,
        fiscalType: dto.fiscalType,
        taxGroupId: dto.taxGroupId,
        icmsCst: dto.icmsCst,
        csosn: dto.csosn,
        icmsAliquot: dto.icmsAliquot,
        ipiCst: dto.ipiCst,
        ipiRate: dto.ipiRate,
        pisCst: dto.pisCst,
        cofinsCst: dto.cofinsCst,
        pisRate: dto.pisRate,
        cofinsRate: dto.cofinsRate,
        fiscalUom: dto.fiscalUom,
        commercialUom: dto.commercialUom,
        ibsCategory: dto.ibsCategory,
        cbsCategory: dto.cbsCategory,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
      },
    });
  }

  listServiceTemplates() {
    const { tenantId } = this.ctx();
    return this.prisma.serviceFiscalTemplate.findMany({
      where: { tenantId },
      orderBy: [{ status: 'asc' }, { code: 'asc' }],
      take: 200,
      include: { taxGroup: true },
    });
  }

  createServiceTemplate(dto: CreateServiceFiscalTemplateDto) {
    const { tenantId } = this.ctx();
    const errors = this.validateRegister({ municipalityCode: dto.issMunicipalityCode });
    if (errors.errors.length) {
      throw new BadRequestException(errors.errors.join(' '));
    }
    return this.prisma.serviceFiscalTemplate.create({
      data: {
        tenantId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        status: dto.status,
        serviceType: dto.serviceType,
        cnae: dto.cnae ? onlyDigits(dto.cnae) : undefined,
        municipalServiceCode: dto.municipalServiceCode,
        lc116ServiceCode: dto.lc116ServiceCode,
        taxGroupId: dto.taxGroupId,
        issRate: dto.issRate,
        issMunicipalityCode: dto.issMunicipalityCode ? onlyDigits(dto.issMunicipalityCode) : undefined,
        issRetention: dto.issRetention,
        irrfRate: dto.irrfRate,
        csllRate: dto.csllRate,
        inssRetentionRate: dto.inssRetentionRate,
        ibsServiceClassification: dto.ibsServiceClassification,
        cbsServiceClassification: dto.cbsServiceClassification,
      },
    });
  }

  listCompanyProfiles() {
    const { tenantId } = this.ctx();
    return this.prisma.companyFiscalProfile.findMany({
      where: { tenantId },
      orderBy: [{ status: 'asc' }, { legalName: 'asc' }],
      take: 100,
      include: { company: true, defaultBusinessTaxGroup: true, defaultProductTaxGroup: true },
    });
  }

  createCompanyProfile(dto: CreateCompanyFiscalProfileDto) {
    const { tenantId } = this.ctx();
    if (!isValidCnpj(dto.cnpj)) {
      throw new BadRequestException('CNPJ invÃ¡lido para perfil fiscal da empresa.');
    }
    return this.prisma.companyFiscalProfile.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        legalName: dto.legalName.trim(),
        tradeName: dto.tradeName,
        cnpj: onlyDigits(dto.cnpj),
        stateRegistration: dto.stateRegistration,
        municipalRegistration: dto.municipalRegistration,
        mainCnae: dto.mainCnae ? onlyDigits(dto.mainCnae) : undefined,
        fiscalRegime: dto.fiscalRegime,
        simplesOption: dto.simplesOption,
        defaultBusinessTaxGroupId: dto.defaultBusinessTaxGroupId,
        defaultProductTaxGroupId: dto.defaultProductTaxGroupId,
        defaultOperationTypeCode: dto.defaultOperationTypeCode,
        obligations: dto.obligations as Prisma.InputJsonValue | undefined,
      },
    });
  }

  listBranches() {
    const { tenantId } = this.ctx();
    return this.prisma.branch.findMany({
      where: { tenantId },
      orderBy: [{ companyId: 'asc' }, { code: 'asc' }],
      take: 200,
      include: { company: true, fiscalJurisdiction: true },
    });
  }

  createBranch(dto: CreateBranchDto) {
    const { tenantId } = this.ctx();
    if (!isValidCnpj(dto.cnpj)) {
      throw new BadRequestException('CNPJ invÃ¡lido para filial.');
    }
    const municipality = this.validateRegister({ municipalityCode: dto.taxMunicipalityCode });
    if (municipality.errors.length) {
      throw new BadRequestException(municipality.errors.join(' '));
    }
    return this.prisma.branch.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        cnpj: onlyDigits(dto.cnpj),
        stateRegistration: dto.stateRegistration,
        municipalRegistration: dto.municipalRegistration,
        fiscalJurisdictionId: dto.fiscalJurisdictionId,
        taxState: dto.taxState?.toUpperCase(),
        taxMunicipalityCode: dto.taxMunicipalityCode ? onlyDigits(dto.taxMunicipalityCode) : undefined,
      },
    });
  }

  listEmployees() {
    const { tenantId } = this.ctx();
    return this.prisma.employee.findMany({
      where: { tenantId },
      orderBy: [{ status: 'asc' }, { fullName: 'asc' }],
      take: 200,
      include: { company: true, branch: true, taxProfiles: true },
    });
  }

  createEmployee(dto: CreateEmployeeDto) {
    const { tenantId } = this.ctx();
    if (!isValidCpf(dto.cpf)) {
      throw new BadRequestException('CPF invÃ¡lido para colaborador.');
    }
    return this.prisma.employee.create({
      data: {
        tenantId,
        companyId: dto.companyId,
        branchId: dto.branchId,
        code: dto.code.trim().toUpperCase(),
        fullName: dto.fullName.trim(),
        cpf: onlyDigits(dto.cpf),
        pisPasep: dto.pisPasep ? onlyDigits(dto.pisPasep) : undefined,
        esocialRegistration: dto.esocialRegistration,
        esocialCategory: dto.esocialCategory,
        laborRegime: dto.laborRegime,
        department: dto.department,
        costCenter: dto.costCenter,
      },
    });
  }

  listPartyProfiles() {
    const { tenantId } = this.ctx();
    return this.prisma.partyFiscalProfile.findMany({
      where: { tenantId },
      orderBy: [{ taxpayerType: 'asc' }, { cnpj: 'asc' }],
      take: 200,
      include: { party: true, businessTaxGroup: true },
    });
  }

  createPartyProfile(dto: CreatePartyFiscalProfileDto) {
    const { tenantId } = this.ctx();
    if (dto.cnpj && !isValidCnpj(dto.cnpj) && !isValidCpf(dto.cnpj)) {
      throw new BadRequestException('Documento fiscal do cliente/fornecedor invÃ¡lido.');
    }
    return this.prisma.partyFiscalProfile.create({
      data: {
        tenantId,
        partyId: dto.partyId,
        cnpj: dto.cnpj ? onlyDigits(dto.cnpj) : undefined,
        stateRegistration: dto.stateRegistration,
        municipalRegistration: dto.municipalRegistration,
        taxpayerType: dto.taxpayerType,
        fiscalRegime: dto.fiscalRegime,
        suframa: dto.suframa,
        consumerFinal: dto.consumerFinal,
        businessTaxGroupId: dto.businessTaxGroupId,
        defaultOperationTypeCode: dto.defaultOperationTypeCode,
        retentionRules: dto.retentionRules as Prisma.InputJsonValue | undefined,
      },
    });
  }

  validateRegister(dto: FiscalRegisterValidationDto) {
    const errors = [
      dto.cpf && !isValidCpf(dto.cpf) ? 'CPF invÃ¡lido.' : null,
      dto.cnpj && !isValidCnpj(dto.cnpj) ? 'CNPJ invÃ¡lido.' : null,
      !hasValidNcmFormat(dto.ncm) ? 'NCM deve conter 8 dÃ­gitos.' : null,
      !hasValidCfopFormat(dto.cfop) ? 'CFOP deve conter 4 dÃ­gitos e iniciar com 1, 2, 3, 5, 6 ou 7.' : null,
      !hasValidCstFormat(dto.cst) ? 'CST/CSOSN deve conter 2 ou 3 dÃ­gitos.' : null,
      !hasValidMunicipalityCodeFormat(dto.municipalityCode) ? 'CÃ³digo IBGE municipal deve conter 7 dÃ­gitos.' : null,
    ].filter((message): message is string => Boolean(message));

    const warnings = [
      dto.cnpj || dto.cpf ? null : 'Informe CPF ou CNPJ quando validar cadastros fiscais de partes.',
      'InscriÃ§Ã£o estadual exige validaÃ§Ã£o especÃ­fica por UF em etapa posterior.',
    ].filter((message): message is string => Boolean(message));

    return { valid: errors.length === 0, errors, warnings };
  }

  listRules(taxKind?: BrazilianTaxKind) {
    const { tenantId } = this.ctx();
    return this.prisma.taxDeterminationRule.findMany({
      where: { tenantId, ...(taxKind ? { taxKind } : {}) },
      orderBy: [{ taxKind: 'asc' }, { priority: 'asc' }, { effectiveFrom: 'desc' }],
      take: 200,
      include: {
        operationType: true,
        businessTaxGroup: true,
        productTaxGroup: true,
        originJurisdiction: true,
        destinationJurisdiction: true,
      },
    });
  }

  async previewTaxes(dto: TaxPreviewDto) {
    const { tenantId } = this.ctx();
    if (!dto.lines.length) {
      throw new BadRequestException('Informe ao menos uma linha para prévia fiscal.');
    }
    const at = dto.documentDate ? new Date(dto.documentDate) : new Date();
    const operationType = await this.prisma.fiscalOperationType.findFirst({
      where: { tenantId, code: dto.operationTypeCode, isActive: true },
    });
    if (!operationType) {
      throw new BadRequestException('Tipo de operação fiscal não encontrado.');
    }
    const company = await this.prisma.company.findFirst({ where: { tenantId, id: dto.companyId } });
    const partyProfile = await this.prisma.partyFiscalProfile.findFirst({
      where: { tenantId, partyId: dto.partyId },
    });
    if (!company) {
      throw new BadRequestException('Empresa inválida para o tenant.');
    }

    const regime = await this.prisma.fiscalRegimeSetup.findFirst({
      where: {
        tenantId,
        AND: [
          { OR: [{ companyId: dto.companyId }, { companyId: null, isDefault: true }] },
          { OR: [{ validTo: null }, { validTo: { gte: at } }] },
        ],
        validFrom: { lte: at },
      },
      orderBy: [{ companyId: 'desc' }, { validFrom: 'desc' }],
    });

    const lines = [];
    let documentTaxTotal = new Prisma.Decimal(0);
    let documentAmount = new Prisma.Decimal(0);

    for (const [idx, line] of dto.lines.entries()) {
      const qty = new Prisma.Decimal(line.quantity);
      const unitAmount = new Prisma.Decimal(line.unitAmount);
      const freightAmount = new Prisma.Decimal(line.freightAmount ?? '0');
      const lineAmount = qty.mul(unitAmount).plus(freightAmount).toDecimalPlaces(2);
      documentAmount = documentAmount.plus(lineAmount);

      const productProfile = line.itemId
        ? await this.prisma.productFiscalProfile.findFirst({ where: { tenantId, itemId: line.itemId } })
        : null;
      const rules = await this.findRules({
        tenantId,
        operationTypeId: operationType.id,
        businessTaxGroupId: partyProfile?.businessTaxGroupId ?? null,
        productTaxGroupId: productProfile?.productTaxGroupId ?? null,
        fiscalRegime: regime?.regime ?? partyProfile?.fiscalRegime ?? null,
        taxpayerType: partyProfile?.taxpayerType ?? null,
        at,
      });

      const taxes = rules.map((rule) => {
        const reducedBase = lineAmount.mul(new Prisma.Decimal(1).minus(rule.reductionRate.div(100)));
        const amount = reducedBase.mul(rule.rate).div(100).toDecimalPlaces(2);
        documentTaxTotal = documentTaxTotal.plus(amount);
        return {
          taxKind: rule.taxKind,
          baseAmount: lineAmount.toString(),
          reducedBaseAmount: reducedBase.toString(),
          rate: rule.rate.toString(),
          amount: amount.toString(),
          isRecoverable: rule.isRecoverable,
          isWithheld: rule.isWithheld,
          ruleId: rule.id,
          formulaCode: rule.formulaCode,
          legalReference: rule.legalReference,
          trace: {
            baseStrategy: rule.baseStrategy,
            priority: rule.priority,
            effectiveFrom: rule.effectiveFrom,
            effectiveTo: rule.effectiveTo,
          },
        };
      });

      lines.push({
        lineNumber: idx + 1,
        description: line.description,
        lineAmount: lineAmount.toString(),
        productFiscalProfile: productProfile
          ? {
              ncm: productProfile.ncm,
              cest: productProfile.cest,
              fiscalOriginCode: productProfile.fiscalOriginCode,
              benefitCode: productProfile.benefitCode,
            }
          : null,
        taxes,
        warnings: [
          productProfile ? null : 'Linha sem perfil fiscal de produto/serviço.',
          taxes.length ? null : 'Nenhuma regra tributária aplicável encontrada.',
        ].filter(Boolean),
      });
    }

    return {
      engine: 'parameter-driven-preview',
      documentDate: at.toISOString(),
      companyId: dto.companyId,
      partyId: dto.partyId,
      operationType: {
        code: operationType.code,
        direction: operationType.direction,
        defaultCfop: operationType.defaultCfop,
      },
      fiscalRegime: regime?.regime ?? partyProfile?.fiscalRegime ?? null,
      taxpayerType: partyProfile?.taxpayerType ?? null,
      totals: {
        documentAmount: documentAmount.toString(),
        taxAmount: documentTaxTotal.toString(),
        totalWithTaxes: documentAmount.plus(documentTaxTotal).toString(),
      },
      lines,
      complianceNotice:
        'Prévia arquitetural: regras, alíquotas e fórmulas devem ser mantidas por configuração fiscal validada por especialista.',
    };
  }

  private findRules(input: {
    tenantId: string;
    operationTypeId: string;
    businessTaxGroupId: string | null;
    productTaxGroupId: string | null;
    fiscalRegime: BrazilianFiscalRegime | null;
    taxpayerType: TaxpayerType | null;
    at: Date;
  }) {
    return this.prisma.taxDeterminationRule.findMany({
      where: {
        tenantId: input.tenantId,
        isActive: true,
        effectiveFrom: { lte: input.at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.at } }],
        AND: [
          { OR: [{ operationTypeId: input.operationTypeId }, { operationTypeId: null }] },
          { OR: [{ businessTaxGroupId: input.businessTaxGroupId }, { businessTaxGroupId: null }] },
          { OR: [{ productTaxGroupId: input.productTaxGroupId }, { productTaxGroupId: null }] },
          { OR: [{ fiscalRegime: input.fiscalRegime }, { fiscalRegime: null }] },
          { OR: [{ taxpayerType: input.taxpayerType }, { taxpayerType: null }] },
        ],
      },
      orderBy: [{ taxKind: 'asc' }, { priority: 'asc' }],
    });
  }
}
