import { Global, Module } from '@nestjs/common';
import { PlatformPrismaService } from '../prisma/platform-prisma.service';
import { SubscriptionEnforcementService } from './subscription-enforcement.service';
import { SubscriptionStatusGuard } from './guards/subscription-status.guard';
import { FeatureFlagGuard } from './guards/feature-flag.guard';
import { QuotaGuard } from './guards/quota.guard';
import { LegalAcceptanceGuard } from './guards/legal-acceptance.guard';

@Global()
@Module({
  providers: [
    PlatformPrismaService,
    SubscriptionEnforcementService,
    SubscriptionStatusGuard,
    FeatureFlagGuard,
    QuotaGuard,
    LegalAcceptanceGuard,
  ],
  exports: [
    SubscriptionEnforcementService,
    SubscriptionStatusGuard,
    FeatureFlagGuard,
    QuotaGuard,
    LegalAcceptanceGuard,
  ],
})
export class SubscriptionModule {}
