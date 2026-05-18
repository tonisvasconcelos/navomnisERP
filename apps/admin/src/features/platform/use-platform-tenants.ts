import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApi, type ApiEnvelope } from '@/lib/platform-api';
import type { TenantSummary } from './types';

const keys = {
  all: ['platform-tenants'] as const,
  list: (search?: string) => [...keys.all, 'list', search] as const,
  detail: (id: string) => [...keys.all, id] as const,
};

export function usePlatformTenants(search?: string) {
  return useQuery({
    queryKey: keys.list(search),
    queryFn: async () => {
      const res = await platformApi.get<ApiEnvelope<{ items: TenantSummary[]; total: number }>>(
        '/platform/tenants',
        { params: { search: search || undefined, take: 100 } },
      );
      return res.data.data;
    },
  });
}

export function usePlatformTenant(id: string | undefined) {
  return useQuery({
    queryKey: keys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await platformApi.get<ApiEnvelope<TenantSummary>>(`/platform/tenants/${id}`);
      return res.data.data;
    },
  });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await platformApi.post<ApiEnvelope<TenantSummary>>('/platform/tenants', body);
      return res.data.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateTenant(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await platformApi.patch<ApiEnvelope<TenantSummary>>(
        `/platform/tenants/${id}`,
        body,
      );
      return res.data.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.all });
      void qc.invalidateQueries({ queryKey: keys.detail(id) });
    },
  });
}

export function useTenantLifecycle(id: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: keys.all });
    void qc.invalidateQueries({ queryKey: keys.detail(id) });
  };
  return {
    activate: useMutation({
      mutationFn: () => platformApi.post(`/platform/tenants/${id}/activate`),
      onSuccess: invalidate,
    }),
    suspend: useMutation({
      mutationFn: () => platformApi.post(`/platform/tenants/${id}/suspend`),
      onSuccess: invalidate,
    }),
    block: useMutation({
      mutationFn: () => platformApi.post(`/platform/tenants/${id}/block`),
      onSuccess: invalidate,
    }),
    restore: useMutation({
      mutationFn: () => platformApi.post(`/platform/tenants/${id}/restore`),
      onSuccess: invalidate,
    }),
    softDelete: useMutation({
      mutationFn: () => platformApi.delete(`/platform/tenants/${id}`),
      onSuccess: invalidate,
    }),
  };
}
