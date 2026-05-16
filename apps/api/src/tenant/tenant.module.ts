import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantContextService } from './tenant-context.service';
import { TenantContextInterceptor } from './tenant-context.interceptor';
import { TenantAccessGuard } from './tenant-access.guard';

@Global()
@Module({
  providers: [
    TenantContextService,
    TenantAccessGuard,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
  ],
  exports: [TenantContextService, TenantAccessGuard],
})
export class TenantModule {}
