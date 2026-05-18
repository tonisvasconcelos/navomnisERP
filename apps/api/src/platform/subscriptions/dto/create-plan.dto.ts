import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuotaResource, SubscriptionPlanType } from '@prisma/client';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PlanFeatureDto {
  @IsString()
  moduleKey!: string;

  @IsOptional()
  enabled?: boolean;
}

class PlanQuotaDto {
  @IsEnum(QuotaResource)
  resource!: QuotaResource;

  @IsInt()
  @Min(0)
  limitValue!: number;
}

export class CreatePlanDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ enum: SubscriptionPlanType })
  @IsOptional()
  @IsEnum(SubscriptionPlanType)
  planType?: SubscriptionPlanType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  priceCents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  billingCycle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  trialDays?: number;

  @ApiPropertyOptional({ type: [PlanFeatureDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanFeatureDto)
  features?: PlanFeatureDto[];

  @ApiPropertyOptional({ type: [PlanQuotaDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanQuotaDto)
  quotas?: PlanQuotaDto[];
}
