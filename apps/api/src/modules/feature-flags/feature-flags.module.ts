import { Global, Module } from '@nestjs/common';
import { TenantFeatureFlagsService } from './tenant-feature-flags.service';

@Global()
@Module({
  providers: [TenantFeatureFlagsService],
  exports: [TenantFeatureFlagsService],
})
export class FeatureFlagsModule {}
