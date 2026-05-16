import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';

export const NOTIFICATIONS_QUEUE = 'notifications';

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE })],
  exports: [BullModule],
})
export class BullQueuesModule {}
