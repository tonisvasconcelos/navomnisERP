import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PrismaService } from '../../../prisma/prisma.service';
import type { EnqueueEmailPayload } from '../notifications.service';

@Processor('notifications')
@Injectable()
export class EmailNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailNotificationProcessor.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<EnqueueEmailPayload>): Promise<void> {
    const apiKey = this.config.get<string>('resendApiKey');
    if (!apiKey) {
      this.logger.warn('Resend não configurado — job ignorado.');
      return;
    }
    const resend = new Resend(apiKey);
    const { to, subject, html, notificationId, tenantId, userId } = job.data;
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, tenantId, userId },
    });
    if (!notification) {
      this.logger.warn(
        `Job send-email: notificação ${notificationId} inexistente ou não coincide com tenant/user — ignorado.`,
      );
      return;
    }
    try {
      const result = await resend.emails.send({
        from: 'Navomnis <onboarding@resend.dev>',
        to,
        subject,
        html,
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
      await this.prisma.notificationDelivery.updateMany({
        where: { notificationId, channel: 'EMAIL', status: 'QUEUED' },
        data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 } },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      await this.prisma.notificationDelivery.updateMany({
        where: { notificationId, channel: 'EMAIL' },
        data: { status: 'FAILED', lastError: msg, attempts: { increment: 1 } },
      });
      throw e;
    }
  }
}
