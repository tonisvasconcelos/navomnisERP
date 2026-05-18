import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApi, type ApiEnvelope } from '@/lib/platform-api';
import type { PlanSummary } from './types';

const keys = {
  plans: ['platform-plans'] as const,
  plan: (id: string) => [...keys.plans, id] as const,
};

export function usePlatformPlans() {
  return useQuery({
    queryKey: keys.plans,
    queryFn: async () => {
      const res = await platformApi.get<ApiEnvelope<PlanSummary[]>>('/platform/subscriptions/plans', {
        params: { all: 'true' },
      });
      return res.data.data;
    },
  });
}

export function usePlatformPlan(id: string | undefined) {
  return useQuery({
    queryKey: keys.plan(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await platformApi.get<ApiEnvelope<PlanSummary>>(
        `/platform/subscriptions/plans/${id}`,
      );
      return res.data.data;
    },
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await platformApi.post<ApiEnvelope<PlanSummary>>(
        '/platform/subscriptions/plans',
        body,
      );
      return res.data.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.plans }),
  });
}

export function usePlanActions(id: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: keys.plans });
    void qc.invalidateQueries({ queryKey: keys.plan(id) });
  };
  return {
    deactivate: useMutation({
      mutationFn: () => platformApi.post(`/platform/subscriptions/plans/${id}/deactivate`),
      onSuccess: invalidate,
    }),
    archive: useMutation({
      mutationFn: () => platformApi.post(`/platform/subscriptions/plans/${id}/archive`),
      onSuccess: invalidate,
    }),
  };
}

export function useAssignSubscription(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { planId: string; status?: string }) => {
      const res = await platformApi.post(
        `/platform/subscriptions/tenants/${tenantId}/assign`,
        body,
      );
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['platform-tenants'] });
    },
  });
}

export function useSubscriptionLifecycle(tenantId: string) {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['platform-tenants'] });
  return {
    suspend: useMutation({
      mutationFn: () =>
        platformApi.post(`/platform/subscriptions/tenants/${tenantId}/suspend`),
      onSuccess: invalidate,
    }),
    cancel: useMutation({
      mutationFn: () => platformApi.post(`/platform/subscriptions/tenants/${tenantId}/cancel`),
      onSuccess: invalidate,
    }),
  };
}
