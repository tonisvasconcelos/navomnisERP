import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ProvisionCadegDto {
  @ApiPropertyOptional({ description: 'Pasta com exportar vendas.csv e Exportar compras.csv' })
  @IsOptional()
  @IsString()
  dataDir?: string;

  @ApiPropertyOptional({ description: 'Enfileirar CSV de vendas completo para importação transacional' })
  @IsOptional()
  @IsBoolean()
  stageTransactions?: boolean;
}
