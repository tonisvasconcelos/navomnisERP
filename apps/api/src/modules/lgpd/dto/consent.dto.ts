import { ApiProperty } from '@nestjs/swagger';
import { ConsentKind } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class ConsentDto {
  @ApiProperty({ enum: ConsentKind })
  @IsEnum(ConsentKind)
  kind!: ConsentKind;

  @ApiProperty()
  @IsString()
  version!: string;
}
