import { AsyncLocalStorage } from 'node:async_hooks';

export type TenantStore = {
  tenantId: string;
  userId: string;
};

export const tenantStorage = new AsyncLocalStorage<TenantStore>();

export function getTenantContext(): TenantStore | undefined {
  return tenantStorage.getStore();
}
