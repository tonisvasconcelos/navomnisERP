import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantStatus } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiPropertyOptional({ enum: TenantStatus })
  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultLanguage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  trialEndsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legalDisplayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customDomain?: string;

  @ApiPropertyOptional({
    description: 'Importar cadastros CADEG (artigos, clientes, fornecedores, UOM) dos CSV legados',
  })
  @IsOptional()
  @IsBoolean()
  provisionCadegMaster?: boolean;

  @ApiPropertyOptional({ description: 'Pasta local com exportar vendas.csv e Exportar compras.csv' })
  @IsOptional()
  @IsString()
  cadegDataDir?: string;

  @ApiPropertyOptional({
    description: 'Enfileirar histórico de vendas (~80k linhas) para importação transacional',
  })
  @IsOptional()
  @IsBoolean()
  stageCadegTransactions?: boolean;
}
