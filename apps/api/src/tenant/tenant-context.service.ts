import { Injectable } from '@nestjs/common';
import { tenantStorage, type TenantStore } from './tenant-storage';

@Injectable()
export class TenantContextService {
  get(): TenantStore | undefined {
    return tenantStorage.getStore();
  }

  require(): TenantStore {
    const ctx = this.get();
    if (!ctx) {
      throw new Error('Contexto de tenant ausente');
    }
    return ctx;
  }

  run<T>(store: TenantStore, fn: () => T): T {
    return tenantStorage.run(store, fn);
  }
}
