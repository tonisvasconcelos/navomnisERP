import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditScope } from '@prisma/client';
import { PlatformPermissions } from '../decorators/platform-permissions.decorator';
import { PlatformJwtGuard } from '../auth/guards/platform-jwt.guard';
import { PlatformPermissionsGuard } from '../rbac/platform-permissions.guard';
import { PlatformContextInterceptor } from '../interceptors/platform-context.interceptor';
import { PlatformPrismaService } from '../../prisma/platform-prisma.service';

@ApiTags('platform-audit')
@ApiBearerAuth()
@Controller({ path: 'platform/audit', version: '1' })
@UseGuards(PlatformJwtGuard, PlatformPermissionsGuard)
@UseInterceptors(PlatformContextInterceptor)
export class PlatformAuditController {
  constructor(private readonly prisma: PlatformPrismaService) {}

  @Get('logs')
  @PlatformPermissions('platform.audit.read')
  @ApiOperation({ summary: 'Logs de auditoria da plataforma' })
  logs(
    @Query('targetTenantId') targetTenantId?: string,
    @Query('take') take?: string,
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        scope: AuditScope.PLATFORM,
        ...(targetTenantId ? { targetTenantId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: take ? Number(take) : 100,
    });
  }

  @Get('platform-logins')
  @PlatformPermissions('platform.audit.read')
  platformLogins(@Query('take') take?: string) {
    return this.prisma.platformLoginHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: take ? Number(take) : 50,
      include: { operator: { select: { email: true, displayName: true } } },
    });
  }
}
