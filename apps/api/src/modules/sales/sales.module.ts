import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { UomModule } from '../uom/uom.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [AuditModule, UomModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
