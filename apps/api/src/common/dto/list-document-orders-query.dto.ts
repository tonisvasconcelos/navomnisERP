import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListDocumentOrdersQueryDto {
  @ApiPropertyOptional({ description: 'Data emissão inicial (ISO ou yyyy-mm-dd)' })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Data emissão final (ISO ou yyyy-mm-dd)' })
  @IsOptional()
  @IsString()
  toDate?: string;

  @ApiPropertyOptional({ default: 10000, maximum: 15000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(15000)
  limit?: number;
}

export function parseOrderDateRange(fromDate?: string, toDate?: string) {
  const range: { gte?: Date; lte?: Date } = {};
  if (fromDate?.trim()) {
    const d = new Date(fromDate.trim());
    if (!Number.isNaN(d.getTime())) range.gte = d;
  }
  if (toDate?.trim()) {
    const d = new Date(toDate.trim());
    if (!Number.isNaN(d.getTime())) {
      d.setUTCHours(23, 59, 59, 999);
      range.lte = d;
    }
  }
  return Object.keys(range).length ? range : undefined;
}
