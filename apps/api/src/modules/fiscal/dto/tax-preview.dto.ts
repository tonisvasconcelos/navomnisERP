import { IsArray, IsDateString, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TaxPreviewLineDto {
  @IsOptional()
  @IsString()
  itemId?: string;

  @IsString()
  description!: string;

  @IsString()
  quantity!: string;

  @IsString()
  unitAmount!: string;

  @IsOptional()
  @IsString()
  freightAmount?: string;
}

export class TaxPreviewDto {
  @IsString()
  companyId!: string;

  @IsString()
  partyId!: string;

  @IsString()
  operationTypeCode!: string;

  @IsOptional()
  @IsDateString()
  documentDate?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TaxPreviewLineDto)
  lines!: TaxPreviewLineDto[];
}
