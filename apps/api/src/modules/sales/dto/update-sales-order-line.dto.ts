import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateSalesOrderLineDto {
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
}
