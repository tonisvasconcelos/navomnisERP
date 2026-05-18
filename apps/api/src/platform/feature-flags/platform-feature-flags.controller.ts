import { Body, Controller, Get, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformPermissions } from '../decorators/platform-permissions.decorator';
import { PlatformJwtGuard } from '../auth/guards/platform-jwt.guard';
import { PlatformPermissionsGuard } from '../rbac/platform-permissions.guard';
import { PlatformAuditInterceptor } from '../interceptors/platform-audit.interceptor';
import { PlatformContextInterceptor } from '../interceptors/platform-context.interceptor';
import { PlatformPrismaService } from '../../prisma/platform-prisma.service';

@ApiTags('platform-feature-flags')
@ApiBearerAuth()
@Controller({ path: 'platform/feature-flags', version: '1' })
@UseGuards(PlatformJwtGuard, PlatformPermissionsGuard)
@UseInterceptors(PlatformContextInterceptor, PlatformAuditInterceptor)
export class PlatformFeatureFlagsController {
  constructor(private readonly prisma: PlatformPrismaService) {}

  @Get('tenants/:tenantId')
  @PlatformPermissions('platform.feature_flags.write')
  list(@Param('tenantId') tenantId: string) {
    return this.prisma.tenantFeatureOverride.findMany({ where: { tenantId } });
  }

  @Post('tenants/:tenantId')
  @PlatformPermissions('platform.feature_flags.write')
  @ApiOperation({ summary: 'Definir override de feature por tenant' })
  set(
    @Param('tenantId') tenantId: string,
    @Body() body: { moduleKey: string; enabled: boolean },
  ) {
    return this.prisma.tenantFeatureOverride.upsert({
      where: { tenantId_moduleKey: { tenantId, moduleKey: body.moduleKey } },
      create: { tenantId, moduleKey: body.moduleKey, enabled: body.enabled },
      update: { enabled: body.enabled },
    });
  }
}
