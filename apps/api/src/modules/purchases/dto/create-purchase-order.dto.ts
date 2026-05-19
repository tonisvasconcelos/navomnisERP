import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class CreatePurchaseOrderDto {
  @ApiProperty()
  @IsUUID()
  companyId!: string;

  @ApiProperty()
  @IsUUID()
  vendorId!: string;
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
}
