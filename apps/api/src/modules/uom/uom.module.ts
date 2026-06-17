import { Module } from '@nestjs/common';
import { UomController } from './uom.controller';
import { UomConversionService } from './uom-conversion.service';
import { UomService } from './uom.service';

@Module({
  controllers: [UomController],
  providers: [UomService, UomConversionService],
  exports: [UomService, UomConversionService],
})
export class UomModule {}
