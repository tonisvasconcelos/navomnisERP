import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  check() {
    return { status: 'ok', service: 'navomnis-api' };
  }

  @Public()
  @Get('db')
  async db() {
    try {
      const db = await this.health.checkDatabase();
      return { status: 'ok', database: db };
    } catch {
      throw new ServiceUnavailableException('database_unavailable');
    }
  }

  @Public()
  @Get('redis')
  async redis() {
    try {
      const redis = await this.health.checkRedis();
      if (!redis.ok) {
        throw new ServiceUnavailableException('redis_unavailable');
      }
      return { status: 'ok', redis };
    } catch (err: unknown) {
      if (err instanceof ServiceUnavailableException) {
        throw err;
      }
      throw new ServiceUnavailableException('redis_unavailable');
    }
  }

  @Public()
  @Get('queues')
  async queues() {
    try {
      const queues = await this.health.checkQueues();
      return { status: 'ok', queues };
    } catch {
      throw new ServiceUnavailableException('queues_unavailable');
    }
  }
}
