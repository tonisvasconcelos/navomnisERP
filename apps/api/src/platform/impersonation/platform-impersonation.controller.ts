import { Controller, ForbiddenException, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuditScope } from '@prisma/client';
import { PlatformPermissions } from '../decorators/platform-permissions.decorator';
import { PlatformJwtGuard } from '../auth/guards/platform-jwt.guard';
import { PlatformPermissionsGuard } from '../rbac/platform-permissions.guard';
import { PlatformAuditInterceptor } from '../interceptors/platform-audit.interceptor';
import { PlatformContextInterceptor } from '../interceptors/platform-context.interceptor';
import type { PlatformJwtPayload } from '../auth/platform-jwt.types';
import { PlatformPrismaService } from '../../prisma/platform-prisma.service';

@ApiTags('platform-impersonation')
@ApiBearerAuth()
@Controller({ path: 'platform/impersonation', version: '1' })
@UseGuards(PlatformJwtGuard, PlatformPermissionsGuard)
@UseInterceptors(PlatformContextInterceptor, PlatformAuditInterceptor)
export class PlatformImpersonationController {
  constructor(private readonly prisma: PlatformPrismaService) {}

  @Post('start')
  @PlatformPermissions('platform.tenants.lifecycle')
  @ApiOperation({ summary: 'Impersonação auditada (placeholder)' })
  async start(
    @Req() req: Request & { user: PlatformJwtPayload },
    @Req() _body: Request,
  ) {
    await this.prisma.auditLog.create({
      data: {
        scope: AuditScope.PLATFORM,
        platformOperatorId: req.user.sub,
        action: 'impersonation.requested',
        entityType: 'impersonation',
        ip: req.ip,
        userAgent: String(req.headers['user-agent'] ?? ''),
        metadata: { note: 'Impersonation tokens not enabled in this build' },
      },
    });
    throw new ForbiddenException(
      'Impersonação requer aprovação adicional; evento registrado em auditoria.',
    );
  }
}
