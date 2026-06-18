import { Module } from '@nestjs/common';
import { ImportsModule } from '../imports/imports.module';
import { UomModule } from '../uom/uom.module';
import { CadegLegacyAnalyticsService } from './cadeg-legacy-analytics.service';
import { CadegMasterDataService } from './cadeg-master-data.service';
import { CadegPurchaseReconstructionService } from './cadeg-purchase-reconstruction.service';

@Module({
  imports: [UomModule, ImportsModule],
  providers: [
    CadegMasterDataService,
    CadegLegacyAnalyticsService,
    CadegPurchaseReconstructionService,
  ],
  exports: [
    CadegMasterDataService,
    CadegLegacyAnalyticsService,
    CadegPurchaseReconstructionService,
  ],
})
export class CadegModule {}
