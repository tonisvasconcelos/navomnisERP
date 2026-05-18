import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DataSubjectRequestStatus, DataSubjectRequestType } from '@prisma/client';
import { PlatformPermissions } from '../decorators/platform-permissions.decorator';
import { PlatformJwtGuard } from '../auth/guards/platform-jwt.guard';
import { PlatformPermissionsGuard } from '../rbac/platform-permissions.guard';
import { PlatformAuditInterceptor } from '../interceptors/platform-audit.interceptor';
import { PlatformContextInterceptor } from '../interceptors/platform-context.interceptor';
import { PlatformLgpdService } from './platform-lgpd.service';

@ApiTags('platform-lgpd')
@ApiBearerAuth()
@Controller({ path: 'platform/lgpd', version: '1' })
@UseGuards(PlatformJwtGuard, PlatformPermissionsGuard)
@UseInterceptors(PlatformContextInterceptor, PlatformAuditInterceptor)
export class PlatformLgpdController {
  constructor(private readonly lgpd: PlatformLgpdService) {}

  @Get('consents/overview')
  @PlatformPermissions('platform.lgpd.read')
  consentOverview() {
    return this.lgpd.consentOverview();
  }

  @Get('requests')
  @PlatformPermissions('platform.lgpd.read')
  requests(@Query('status') status?: DataSubjectRequestStatus) {
    return this.lgpd.listRequests(status);
  }

  @Post('requests')
  @PlatformPermissions('platform.lgpd.dsar')
  createRequest(
    @Body()
    body: {
      tenantId: string;
      userId?: string;
      email?: string;
      requestType: DataSubjectRequestType;
      notes?: string;
    },
  ) {
    return this.lgpd.createRequest(body);
  }

  @Patch('requests/:id/status')
  @PlatformPermissions('platform.lgpd.dsar')
  updateStatus(@Param('id') id: string, @Body('status') status: DataSubjectRequestStatus) {
    return this.lgpd.updateRequestStatus(id, status);
  }

  @Get('retention')
  @PlatformPermissions('platform.lgpd.read')
  retention() {
    return this.lgpd.retentionPolicies();
  }
}
