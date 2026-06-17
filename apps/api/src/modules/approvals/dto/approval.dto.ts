import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApprovalDocumentType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateApprovalPolicyDto {
  @ApiProperty({ enum: ApprovalDocumentType })
  @IsEnum(ApprovalDocumentType)
  documentType!: ApprovalDocumentType;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  minAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maxAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vendorId?: string;
}

export class CreateApprovalPolicyStepDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  sequence!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  approverRoleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  approverUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  minApprovals?: number;
}

export class ApprovalActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}
