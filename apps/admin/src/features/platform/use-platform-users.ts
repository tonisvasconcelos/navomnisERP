import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApi, type ApiEnvelope } from '@/lib/platform-api';
import type { UserSummary } from './types';

const keys = {
  all: ['platform-users'] as const,
  list: (search?: string, tenantId?: string) => [...keys.all, 'list', search, tenantId] as const,
  detail: (id: string) => [...keys.all, id] as const,
};

export function usePlatformUsers(search?: string, tenantId?: string) {
  return useQuery({
    queryKey: keys.list(search, tenantId),
    queryFn: async () => {
      const res = await platformApi.get<ApiEnvelope<{ items: UserSummary[]; total: number }>>(
        '/platform/users',
        {
          params: {
            search: search || undefined,
            tenantId: tenantId || undefined,
            take: 100,
          },
        },
      );
      return res.data.data;
    },
  });
}

export function usePlatformUser(id: string | undefined) {
  return useQuery({
    queryKey: keys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await platformApi.get<ApiEnvelope<UserSummary>>(`/platform/users/${id}`);
      return res.data.data;
    },
  });
}

export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { email: string; displayName: string; tenantId: string }) => {
      const res = await platformApi.post<
        ApiEnvelope<{ inviteUrl: string; token: string; user: UserSummary }>
      >('/platform/users/invite', body);
      return res.data.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateUser(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { displayName?: string; locale?: string }) => {
      const res = await platformApi.patch<ApiEnvelope<UserSummary>>(
        `/platform/users/${id}`,
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

export function useAssignTenant(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { tenantId: string; isDefault?: boolean }) => {
      const res = await platformApi.post(`/platform/users/${userId}/assign-tenant`, body);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.all });
      void qc.invalidateQueries({ queryKey: keys.detail(userId) });
    },
  });
}

export function useUserSecurity(userId: string) {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: keys.detail(userId) });
  return {
    block: useMutation({ mutationFn: () => platformApi.post(`/platform/users/${userId}/block`), onSuccess: invalidate }),
    unblock: useMutation({ mutationFn: () => platformApi.post(`/platform/users/${userId}/unblock`), onSuccess: invalidate }),
    forceReset: useMutation({
      mutationFn: () => platformApi.post(`/platform/users/${userId}/force-password-reset`),
      onSuccess: invalidate,
    }),
    revokeSessions: useMutation({
      mutationFn: () => platformApi.post(`/platform/users/${userId}/revoke-sessions`),
      onSuccess: invalidate,
    }),
  };
}
