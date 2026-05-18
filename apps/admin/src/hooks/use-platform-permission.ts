import { usePlatformAuthStore } from '@/store/auth-store';

export function usePlatformPermission(code: string): boolean {
  const permissions = usePlatformAuthStore((s) => s.permissions);
  return permissions.includes(code);
}
