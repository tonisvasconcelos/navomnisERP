import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class CreatePurchaseOrderDto {
  @ApiProperty()
  @IsUUID()
  companyId!: string;

  @ApiProperty()
  @IsUUID()
  vendorId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expectedDeliveryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  freightTerms?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  buyerNotes?: string;
}

export class AddPurchaseOrderLineDto {
  @ApiProperty()
  @IsUUID()
  itemId!: string;

  @ApiProperty({ example: '2' })
  @IsString()
  @MinLength(1)
  @MaxLength(24)
  @Matches(/^\d+(\.\d+)?$/)
  quantity!: string;

  @ApiProperty({ example: '10.50' })
  @IsString()
  @MinLength(1)
  @MaxLength(24)
  @Matches(/^\d+(\.\d+)?$/)
  unitCost!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  transactionUomId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  packageCount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  grossWeightKg?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tareWeightKg?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  netWeightKg?: string;
}
