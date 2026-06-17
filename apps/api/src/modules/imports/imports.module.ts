import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { IMPORTS_QUEUE, ImportsProcessor, ImportsService } from './imports.service';
import { ImportsController } from './imports.controller';

@Module({
  imports: [BullModule.registerQueue({ name: IMPORTS_QUEUE })],
  controllers: [ImportsController],
  providers: [ImportsService, ImportsProcessor],
  exports: [ImportsService],
})
export class ImportsModule {}
