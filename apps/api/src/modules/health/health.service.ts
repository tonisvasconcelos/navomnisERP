import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  async checkDatabase(): Promise<{ ok: boolean; latencyMs: number }> {
    const started = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - started };
  }

  async checkRedis(): Promise<{ ok: boolean; latencyMs: number }> {
    const url = process.env.REDIS_URL;
    if (!url) {
      return { ok: false, latencyMs: 0 };
    }
    const client = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: false });
    try {
      const started = Date.now();
      const pong = await client.ping();
      return { ok: pong === 'PONG', latencyMs: Date.now() - started };
    } finally {
      client.disconnect();
    }
  }

  async checkQueues(): Promise<{ queue: string; counts: Record<string, number> }> {
    const counts = await this.notificationsQueue.getJobCounts();
    return { queue: 'notifications', counts };
  }
}
