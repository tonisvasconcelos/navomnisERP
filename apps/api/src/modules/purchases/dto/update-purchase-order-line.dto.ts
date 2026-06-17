import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdatePurchaseOrderLineDto {
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
}
