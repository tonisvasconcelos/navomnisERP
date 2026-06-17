import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { UomKind } from '@prisma/client';

export class CreateUomDto {
  @ApiProperty({ example: 'KG' })
  @IsString()
  @MaxLength(16)
  code!: string;

  @ApiProperty({ example: 'Quilograma' })
  @IsString()
  @MaxLength(64)
  name!: string;

  @ApiPropertyOptional({ enum: UomKind })
  @IsOptional()
  kind?: UomKind;

  @ApiPropertyOptional()
  @IsOptional()
  decimalScale?: number;
}

export class CreateUomAliasDto {
  @ApiProperty()
  @IsUUID()
  uomId!: string;

  @ApiProperty({ example: 'Kg' })
  @IsString()
  @MaxLength(32)
  alias!: string;
}

export class CreateItemConversionDto {
  @ApiProperty()
  @IsUUID()
  fromUomId!: string;

  @ApiProperty()
  @IsUUID()
  toUomId!: string;

  @ApiProperty({ example: '12' })
  @IsString()
  @Matches(/^\d+(\.\d+)?$/)
  factor!: string;
}

export class ConvertQuantityDto {
  @ApiProperty()
  @IsUUID()
  itemId!: string;

  @ApiProperty()
  @IsUUID()
  fromUomId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  toUomId?: string;

  @ApiProperty({ example: '2' })
  @IsString()
  @MinLength(1)
  quantity!: string;
}

export class SupplierItemUomDto {
  @ApiProperty()
  @IsUUID()
  supplierId!: string;

  @ApiProperty()
  @IsUUID()
  itemId!: string;

  @ApiProperty()
  @IsUUID()
  purchaseUomId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierSku?: string;
}
