import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateItemDto {
  @ApiProperty({ example: 'ITEM-NEW-1' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  sku!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'UN' })
  @IsString()
  @Matches(/^[A-Z0-9]{1,8}$/)
  baseUom!: string;
}
