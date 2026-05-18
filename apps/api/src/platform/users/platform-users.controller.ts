import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformPermissions } from '../decorators/platform-permissions.decorator';
import { PlatformJwtGuard } from '../auth/guards/platform-jwt.guard';
import { PlatformPermissionsGuard } from '../rbac/platform-permissions.guard';
import { PlatformAuditInterceptor } from '../interceptors/platform-audit.interceptor';
import { PlatformContextInterceptor } from '../interceptors/platform-context.interceptor';
import { InvitePlatformUserDto } from './dto/invite-platform-user.dto';
import { UpdatePlatformUserDto } from './dto/update-platform-user.dto';
import { PlatformUsersService } from './platform-users.service';

@ApiTags('platform-users')
@ApiBearerAuth()
@Controller({ path: 'platform/users', version: '1' })
@UseGuards(PlatformJwtGuard, PlatformPermissionsGuard)
@UseInterceptors(PlatformContextInterceptor, PlatformAuditInterceptor)
export class PlatformUsersController {
  constructor(private readonly users: PlatformUsersService) {}

  @Get()
  @PlatformPermissions('platform.users.read')
  async list(
    @Query('search') search?: string,
    @Query('tenantId') tenantId?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const [items, total] = await this.users.list({
      search,
      tenantId,
      skip: skip ? Number(skip) : 0,
      take: take ? Number(take) : 50,
    });
    return { items, total };
  }

  @Get('invites')
  @PlatformPermissions('platform.users.read')
  @ApiOperation({ summary: 'Listar convites pendentes' })
  async listInvites(
    @Query('tenantId') tenantId?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const [items, total] = await this.users.listInvites({
      tenantId,
      skip: skip ? Number(skip) : 0,
      take: take ? Number(take) : 50,
    });
    return { items, total };
  }

  @Post('invite')
  @PlatformPermissions('platform.users.write')
  @ApiOperation({ summary: 'Convidar utilizador (sem senha)' })
  invite(@Body() dto: InvitePlatformUserDto) {
    return this.users.invite(dto);
  }

  @Get(':id')
  @PlatformPermissions('platform.users.read')
  get(@Param('id') id: string) {
    return this.users.get(id);
  }

  @Patch(':id')
  @PlatformPermissions('platform.users.write')
  update(@Param('id') id: string, @Body() dto: UpdatePlatformUserDto) {
    return this.users.update(id, dto);
  }

  @Post(':id/block')
  @PlatformPermissions('platform.users.security')
  block(@Param('id') id: string) {
    return this.users.block(id);
  }

  @Post(':id/unblock')
  @PlatformPermissions('platform.users.security')
  unblock(@Param('id') id: string) {
    return this.users.unblock(id);
  }

  @Post(':id/force-password-reset')
  @PlatformPermissions('platform.users.security')
  forceReset(@Param('id') id: string) {
    return this.users.forcePasswordReset(id);
  }

  @Post(':id/revoke-sessions')
  @PlatformPermissions('platform.users.security')
  revokeSessions(@Param('id') id: string) {
    return this.users.revokeSessions(id);
  }

  @Post(':id/assign-tenant')
  @PlatformPermissions('platform.users.write')
  assignTenant(
    @Param('id') id: string,
    @Body() body: { tenantId: string; isDefault?: boolean },
  ) {
    return this.users.assignTenant(id, body.tenantId, body.isDefault ?? false);
  }
}
