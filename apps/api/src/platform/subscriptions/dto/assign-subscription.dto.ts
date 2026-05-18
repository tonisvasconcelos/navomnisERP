import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantSubscriptionStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class AssignSubscriptionDto {
  @ApiProperty()
  @IsUUID()
  planId!: string;

  @ApiPropertyOptional({ enum: TenantSubscriptionStatus })
  @IsOptional()
  @IsEnum(TenantSubscriptionStatus)
  status?: TenantSubscriptionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  graceEndsAt?: string;
}
