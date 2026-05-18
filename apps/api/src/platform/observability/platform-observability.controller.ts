import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformPermissions } from '../decorators/platform-permissions.decorator';
import { PlatformJwtGuard } from '../auth/guards/platform-jwt.guard';
import { PlatformPermissionsGuard } from '../rbac/platform-permissions.guard';
import { PlatformAuditInterceptor } from '../interceptors/platform-audit.interceptor';
import { PlatformContextInterceptor } from '../interceptors/platform-context.interceptor';
import { PlatformPrismaService } from '../../prisma/platform-prisma.service';

@ApiTags('platform-observability')
@ApiBearerAuth()
@Controller({ path: 'platform/observability', version: '1' })
@UseGuards(PlatformJwtGuard, PlatformPermissionsGuard)
@UseInterceptors(PlatformContextInterceptor, PlatformAuditInterceptor)
export class PlatformObservabilityController {
  constructor(private readonly prisma: PlatformPrismaService) {}

  @Get('health')
  @PlatformPermissions('platform.telemetry.read')
  @ApiOperation({ summary: 'Saúde agregada da plataforma' })
  async health() {
    const queues = await this.prisma.queueHealthSnapshot.findMany({
      orderBy: { capturedAt: 'desc' },
      take: 10,
      distinct: ['queueName'],
    });
    return {
      api: 'ok',
      database: 'ok',
      redis: process.env.REDIS_URL ? 'configured' : 'missing',
      queues,
      sentry: Boolean(process.env.SENTRY_DSN_API),
    };
  }
}
