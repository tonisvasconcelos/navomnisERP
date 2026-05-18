import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConsentKind } from '@prisma/client';
import type { Request } from 'express';
import { PlatformPermissions } from '../decorators/platform-permissions.decorator';
import { PlatformJwtGuard } from '../auth/guards/platform-jwt.guard';
import { PlatformPermissionsGuard } from '../rbac/platform-permissions.guard';
import { PlatformAuditInterceptor } from '../interceptors/platform-audit.interceptor';
import { PlatformContextInterceptor } from '../interceptors/platform-context.interceptor';
import type { PlatformJwtPayload } from '../auth/platform-jwt.types';
import { PlatformLegalService } from './platform-legal.service';

@ApiTags('platform-legal')
@ApiBearerAuth()
@Controller({ path: 'platform/legal', version: '1' })
@UseGuards(PlatformJwtGuard, PlatformPermissionsGuard)
@UseInterceptors(PlatformContextInterceptor, PlatformAuditInterceptor)
export class PlatformLegalController {
  constructor(private readonly legal: PlatformLegalService) {}

  @Get('documents')
  @PlatformPermissions('platform.legal.read')
  list(@Query('kind') kind?: ConsentKind) {
    return this.legal.list(kind);
  }

  @Post('documents')
  @PlatformPermissions('platform.legal.write')
  create(
    @Body()
    body: {
      kind: ConsentKind;
      version: string;
      content: string;
      isMandatory?: boolean;
      effectiveAt?: string;
    },
  ) {
    return this.legal.createDraft(body);
  }

  @Post('documents/:id/publish')
  @PlatformPermissions('platform.legal.publish')
  publish(@Param('id') id: string, @Req() req: Request & { user: PlatformJwtPayload }) {
    return this.legal.publish(id, req.user.sub);
  }
}
