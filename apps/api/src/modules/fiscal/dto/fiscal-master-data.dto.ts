import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  BrazilianFiscalRegime,
  FiscalRegisterStatus,
  ItemFiscalType,
  LaborRegime,
  ServiceFiscalType,
  TaxpayerType,
} from '@prisma/client';

export class CreateItemFiscalTemplateDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsEnum(FiscalRegisterStatus)
  status?: FiscalRegisterStatus;

  @IsOptional()
  @IsString()
  ncm?: string;

  @IsOptional()
  @IsString()
  cest?: string;

  @IsOptional()
  @IsString()
  productOrigin?: string;

  @IsOptional()
  @IsEnum(ItemFiscalType)
  fiscalType?: ItemFiscalType;

  @IsOptional()
  @IsString()
  taxGroupId?: string;

  @IsOptional()
  @IsString()
  icmsCst?: string;

  @IsOptional()
  @IsString()
  csosn?: string;

  @IsOptional()
  @IsString()
  icmsAliquot?: string;

  @IsOptional()
  @IsString()
  ipiCst?: string;

  @IsOptional()
  @IsString()
  ipiRate?: string;

  @IsOptional()
  @IsString()
  pisCst?: string;

  @IsOptional()
  @IsString()
  cofinsCst?: string;

  @IsOptional()
  @IsString()
  pisRate?: string;

  @IsOptional()
  @IsString()
  cofinsRate?: string;

  @IsOptional()
  @IsString()
  fiscalUom?: string;

  @IsOptional()
  @IsString()
  commercialUom?: string;

  @IsOptional()
  @IsString()
  ibsCategory?: string;

  @IsOptional()
  @IsString()
  cbsCategory?: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;
}

export class CreateServiceFiscalTemplateDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsEnum(FiscalRegisterStatus)
  status?: FiscalRegisterStatus;

  @IsOptional()
  @IsEnum(ServiceFiscalType)
  serviceType?: ServiceFiscalType;

  @IsOptional()
  @IsString()
  cnae?: string;

  @IsOptional()
  @IsString()
  municipalServiceCode?: string;

  @IsOptional()
  @IsString()
  lc116ServiceCode?: string;

  @IsOptional()
  @IsString()
  taxGroupId?: string;

  @IsOptional()
  @IsString()
  issRate?: string;

  @IsOptional()
  @IsString()
  issMunicipalityCode?: string;

  @IsOptional()
  @IsBoolean()
  issRetention?: boolean;

  @IsOptional()
  @IsString()
  irrfRate?: string;

  @IsOptional()
  @IsString()
  csllRate?: string;

  @IsOptional()
  @IsString()
  inssRetentionRate?: string;

  @IsOptional()
  @IsString()
  ibsServiceClassification?: string;

  @IsOptional()
  @IsString()
  cbsServiceClassification?: string;
}

export class CreateCompanyFiscalProfileDto {
  @IsString()
  companyId!: string;

  @IsString()
  legalName!: string;

  @IsOptional()
  @IsString()
  tradeName?: string;

  @IsString()
  cnpj!: string;

  @IsOptional()
  @IsString()
  stateRegistration?: string;

  @IsOptional()
  @IsString()
  municipalRegistration?: string;

  @IsOptional()
  @IsString()
  mainCnae?: string;

  @IsEnum(BrazilianFiscalRegime)
  fiscalRegime!: BrazilianFiscalRegime;

  @IsOptional()
  @IsBoolean()
  simplesOption?: boolean;

  @IsOptional()
  @IsString()
  defaultBusinessTaxGroupId?: string;

  @IsOptional()
  @IsString()
  defaultProductTaxGroupId?: string;

  @IsOptional()
  @IsString()
  defaultOperationTypeCode?: string;

  @IsOptional()
  @IsObject()
  obligations?: Record<string, unknown>;
}

export class CreateBranchDto {
  @IsString()
  companyId!: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  cnpj!: string;

  @IsOptional()
  @IsString()
  stateRegistration?: string;

  @IsOptional()
  @IsString()
  municipalRegistration?: string;

  @IsOptional()
  @IsString()
  fiscalJurisdictionId?: string;

  @IsOptional()
  @IsString()
  taxState?: string;

  @IsOptional()
  @IsString()
  taxMunicipalityCode?: string;
}

export class CreateEmployeeDto {
  @IsString()
  companyId!: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsString()
  code!: string;

  @IsString()
  fullName!: string;

  @IsString()
  cpf!: string;

  @IsOptional()
  @IsString()
  pisPasep?: string;

  @IsOptional()
  @IsString()
  esocialRegistration?: string;

  @IsOptional()
  @IsString()
  esocialCategory?: string;

  @IsOptional()
  @IsEnum(LaborRegime)
  laborRegime?: LaborRegime;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  costCenter?: string;
}

export class CreatePartyFiscalProfileDto {
  @IsString()
  partyId!: string;

  @IsOptional()
  @IsString()
  cnpj?: string;

  @IsOptional()
  @IsString()
  stateRegistration?: string;

  @IsOptional()
  @IsString()
  municipalRegistration?: string;

  @IsOptional()
  @IsEnum(TaxpayerType)
  taxpayerType?: TaxpayerType;

  @IsOptional()
  @IsEnum(BrazilianFiscalRegime)
  fiscalRegime?: BrazilianFiscalRegime;

  @IsOptional()
  @IsString()
  suframa?: string;

  @IsOptional()
  @IsBoolean()
  consumerFinal?: boolean;

  @IsOptional()
  @IsString()
  businessTaxGroupId?: string;

  @IsOptional()
  @IsString()
  defaultOperationTypeCode?: string;

  @IsOptional()
  @IsObject()
  retentionRules?: Record<string, unknown>;
}

export class FiscalRegisterValidationDto {
  @IsOptional()
  @IsString()
  cpf?: string;

  @IsOptional()
  @IsString()
  cnpj?: string;

  @IsOptional()
  @IsString()
  ncm?: string;

  @IsOptional()
  @IsString()
  cfop?: string;

  @IsOptional()
  @IsString()
  cst?: string;

  @IsOptional()
  @IsString()
  municipalityCode?: string;
}
