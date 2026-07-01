import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class ItemAvailableUomsQueryDto {
  @IsIn(['sales', 'purchase', 'receipt'])
  context!: 'sales' | 'purchase' | 'receipt';

  @IsOptional()
  @IsUUID()
  partyId?: string;
}
