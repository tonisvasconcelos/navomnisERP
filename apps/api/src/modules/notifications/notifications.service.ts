import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import type { NotificationType } from '@prisma/client';

export type EnqueueEmailPayload = {
  notificationId: string;
  tenantId: string;
  userId: string;
  to: string;
  subject: string;
  html: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notifications') private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  async enqueueEmail(payload: EnqueueEmailPayload) {
    await this.queue.add('send-email', payload, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: false,
    });
  }

  async createInAppAndEmail(opts: {
    tenantId: string;
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    toEmail: string;
    emailSubject: string;
    emailHtml: string;
  }) {
    const n = await this.prisma.notification.create({
      data: {
        tenantId: opts.tenantId,
        userId: opts.userId,
        type: opts.type,
        title: opts.title,
        body: opts.body,
        deliveries: {
          create: {
            channel: 'EMAIL',
            status: 'QUEUED',
          },
        },
      },
      include: { deliveries: true },
    });
    const deliveryId = n.deliveries[0]?.id;
    if (this.config.get<string>('resendApiKey')) {
      await this.enqueueEmail({
        notificationId: n.id,
        tenantId: opts.tenantId,
        userId: opts.userId,
        to: opts.toEmail,
        subject: opts.emailSubject,
        html: opts.emailHtml,
      });
    } else {
      this.logger.warn('RESEND_API_KEY ausente — e-mail não enfileirado.');
    }
    return { notification: n, deliveryId };
  }

  listForUser(userId: string, tenantId: string) {
    return this.prisma.notification.findMany({
      where: { userId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
