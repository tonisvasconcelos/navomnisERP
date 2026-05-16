import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class StartConnectionDto {
  @ApiProperty()
  @IsUUID()
  companyId!: string;

  @ApiProperty({ description: 'FinancialInstitution id' })
  @IsUUID()
  institutionId!: string;
}

export class ListTransactionsQueryDto {
  @ApiProperty()
  @IsUUID()
  companyId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  transactionType?: string;

  @ApiPropertyOptional({ description: 'Pix E2E id' })
  @IsOptional()
  @IsString()
  endToEndId?: string;
}

export class SuggestReconciliationDto {
  @ApiProperty()
  @IsUUID()
  companyId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  bankTransactionId?: string;
}

export class ConfirmMatchDto {
  @ApiProperty()
  @IsUUID()
  companyId!: string;
}
