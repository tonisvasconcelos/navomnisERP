import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty()
  @IsString()
  displayName!: string;

  @ApiProperty({ example: 'minha-empresa' })
  @IsString()
  @MinLength(2)
  tenantSlug!: string;

  @ApiProperty()
  @IsString()
  tenantName!: string;
}
