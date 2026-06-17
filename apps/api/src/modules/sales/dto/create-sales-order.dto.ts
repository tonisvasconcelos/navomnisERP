import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateSalesOrderDto {
  @ApiProperty()
  @IsUUID()
  companyId!: string;

  @ApiProperty()
  @IsUUID()
  customerId!: string;
}

export class AddSalesOrderLineDto {
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
  unitPrice!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  transactionUomId?: string;
}
