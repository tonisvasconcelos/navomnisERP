import { Module } from '@nestjs/common';
import { ImportsModule } from '../imports/imports.module';
import { UomModule } from '../uom/uom.module';
import { CadegMasterDataService } from './cadeg-master-data.service';

@Module({
  imports: [UomModule, ImportsModule],
  providers: [CadegMasterDataService],
  exports: [CadegMasterDataService],
})
export class CadegModule {}
