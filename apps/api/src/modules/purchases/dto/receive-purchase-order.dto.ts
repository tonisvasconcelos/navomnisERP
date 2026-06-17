import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class ReceivePurchaseLineDto {
  @ApiProperty()
  @IsUUID()
  lineId!: string;

  @ApiProperty({ example: '1.0000' })
  @IsString()
  quantity!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  transactionUomId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lotCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expirationDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  createQualityInspection?: boolean;
}

export class ReceivePurchaseOrderDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  createLot?: boolean;

  @ApiProperty({ type: [ReceivePurchaseLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseLineDto)
  lines!: ReceivePurchaseLineDto[];
}
