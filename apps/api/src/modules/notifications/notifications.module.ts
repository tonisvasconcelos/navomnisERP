import { DynamicModule, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { EmailNotificationProcessor } from './processors/email-notification.processor';

@Module({})
export class NotificationsModule {
  static forApi(): DynamicModule {
    return {
      module: NotificationsModule,
      controllers: [NotificationsController],
      providers: [NotificationsService],
      exports: [NotificationsService],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: NotificationsModule,
      controllers: [],
      providers: [NotificationsService, EmailNotificationProcessor],
      exports: [],
    };
  }
}
