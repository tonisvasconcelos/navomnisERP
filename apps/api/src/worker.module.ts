import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration } from './config/configuration';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { BullQueuesModule } from './queues/bull-queues.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
      },
    }),
    BullQueuesModule,
    PrismaModule,
    NotificationsModule.forWorker(),
  ],
})
export class WorkerModule {}
