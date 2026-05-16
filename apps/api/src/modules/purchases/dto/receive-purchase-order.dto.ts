import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsString, IsUUID, ValidateNested } from 'class-validator';

export class ReceivePurchaseLineDto {
  @ApiProperty()
  @IsUUID()
  lineId!: string;

  @ApiProperty({ example: '1.0000' })
  @IsString()
  quantity!: string;
}

export class ReceivePurchaseOrderDto {
  @ApiProperty({ type: [ReceivePurchaseLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseLineDto)
  lines!: ReceivePurchaseLineDto[];
}
