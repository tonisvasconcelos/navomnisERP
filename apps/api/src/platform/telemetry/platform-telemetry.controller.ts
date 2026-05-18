import { Body, Controller, Get, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TelemetryEventKind } from '@prisma/client';
import { PlatformPermissions } from '../decorators/platform-permissions.decorator';
import { PlatformJwtGuard } from '../auth/guards/platform-jwt.guard';
import { PlatformPermissionsGuard } from '../rbac/platform-permissions.guard';
import { PlatformAuditInterceptor } from '../interceptors/platform-audit.interceptor';
import { PlatformContextInterceptor } from '../interceptors/platform-context.interceptor';
import { PlatformTelemetryService } from './platform-telemetry.service';

@ApiTags('platform-telemetry')
@ApiBearerAuth()
@Controller({ path: 'platform/telemetry', version: '1' })
@UseGuards(PlatformJwtGuard, PlatformPermissionsGuard)
@UseInterceptors(PlatformContextInterceptor, PlatformAuditInterceptor)
export class PlatformTelemetryController {
  constructor(private readonly telemetry: PlatformTelemetryService) {}

  @Get('metrics')
  @PlatformPermissions('platform.telemetry.read')
  @ApiOperation({ summary: 'KPIs SaaS agregados' })
  metrics() {
    return this.telemetry.dashboardMetrics();
  }

  @Get('events')
  @PlatformPermissions('platform.telemetry.read')
  events(
    @Query('kind') kind?: TelemetryEventKind,
    @Query('tenantId') tenantId?: string,
    @Query('take') take?: string,
  ) {
    return this.telemetry.listEvents({ kind, tenantId, take: take ? Number(take) : 100 });
  }

  @Post('events')
  @PlatformPermissions('platform.telemetry.read')
  ingest(@Body() body: { kind: TelemetryEventKind; tenantId?: string; payload?: Record<string, unknown> }) {
    return this.telemetry.ingest(body.kind, body.payload, body.tenantId);
  }
}
