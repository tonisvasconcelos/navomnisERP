import { AsyncLocalStorage } from 'node:async_hooks';

export type PlatformContext = {
  operatorId: string;
  requestId?: string;
};

const storage = new AsyncLocalStorage<PlatformContext>();

export function runWithPlatformContext<T>(ctx: PlatformContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getPlatformContext(): PlatformContext | undefined {
  return storage.getStore();
}
