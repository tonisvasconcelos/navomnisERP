import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

export type ItemAvailableUomOption = {
  uomId: string;
  code: string;
  name: string;
  isBase: boolean;
  conversionPreview?: {
    factor: string;
    baseQuantity: string;
    baseUomId: string;
  };
  warning?: string;
};

export type ItemAvailableUomsResponse = {
  itemId: string;
  baseUom: { id?: string; code: string; name: string };
  defaultUomId: string;
  available: ItemAvailableUomOption[];
};

function unwrap<T>(envelope: unknown): T {
  return ((envelope as { data?: T }).data ?? envelope) as T;
}

export function useItemAvailableUoms(
  itemId: string | undefined,
  context: 'sales' | 'purchase' | 'receipt',
  partyId?: string,
) {
  return useQuery({
    queryKey: ['item-available-uoms', itemId, context, partyId],
    enabled: Boolean(itemId),
    queryFn: async () => {
      const params: Record<string, string> = { context };
      if (partyId) params.partyId = partyId;
      const { data: envelope } = await api.get(`/uom/items/${itemId}/available`, { params });
      return unwrap<ItemAvailableUomsResponse>(envelope);
    },
    staleTime: 30_000,
  });
}
