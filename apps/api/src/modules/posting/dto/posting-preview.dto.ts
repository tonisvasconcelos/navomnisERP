import { IsDateString, IsOptional, IsString } from 'class-validator';

export class PostingPreviewDto {
  @IsString()
  sourceType!: string;

  @IsString()
  sourceId!: string;

  @IsOptional()
  @IsDateString()
  postingDate?: string;
}
