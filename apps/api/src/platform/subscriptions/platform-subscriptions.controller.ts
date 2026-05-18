import { Body, Controller, Get, Param, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformPermissions } from '../decorators/platform-permissions.decorator';
import { PlatformJwtGuard } from '../auth/guards/platform-jwt.guard';
import { PlatformPermissionsGuard } from '../rbac/platform-permissions.guard';
import { PlatformAuditInterceptor } from '../interceptors/platform-audit.interceptor';
import { PlatformContextInterceptor } from '../interceptors/platform-context.interceptor';
import { AssignSubscriptionDto } from './dto/assign-subscription.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { PlatformSubscriptionsService } from './platform-subscriptions.service';

@ApiTags('platform-subscriptions')
@ApiBearerAuth()
@Controller({ path: 'platform/subscriptions', version: '1' })
@UseGuards(PlatformJwtGuard, PlatformPermissionsGuard)
@UseInterceptors(PlatformContextInterceptor, PlatformAuditInterceptor)
export class PlatformSubscriptionsController {
  constructor(private readonly subscriptions: PlatformSubscriptionsService) {}

  @Get('plans')
  @PlatformPermissions('platform.subscriptions.read')
  listPlans(@Query('all') all?: string) {
    return this.subscriptions.listPlans(all !== 'true');
  }

  @Get('plans/:id')
  @PlatformPermissions('platform.subscriptions.read')
  getPlan(@Param('id') id: string) {
    return this.subscriptions.getPlan(id);
  }

  @Post('plans')
  @PlatformPermissions('platform.subscriptions.write')
  createPlan(@Body() dto: CreatePlanDto) {
    return this.subscriptions.createPlan(dto);
  }

  @Post('plans/:id/deactivate')
  @PlatformPermissions('platform.subscriptions.write')
  deactivate(@Param('id') id: string) {
    return this.subscriptions.deactivatePlan(id);
  }

  @Post('plans/:id/archive')
  @PlatformPermissions('platform.subscriptions.write')
  archive(@Param('id') id: string) {
    return this.subscriptions.archivePlan(id);
  }

  @Post('tenants/:tenantId/assign')
  @PlatformPermissions('platform.subscriptions.write')
  assign(@Param('tenantId') tenantId: string, @Body() dto: AssignSubscriptionDto) {
    return this.subscriptions.assignToTenant(tenantId, dto);
  }

  @Post('tenants/:tenantId/suspend')
  @PlatformPermissions('platform.subscriptions.write')
  suspend(@Param('tenantId') tenantId: string) {
    return this.subscriptions.suspendSubscription(tenantId);
  }

  @Post('tenants/:tenantId/cancel')
  @PlatformPermissions('platform.subscriptions.write')
  cancel(@Param('tenantId') tenantId: string) {
    return this.subscriptions.cancelSubscription(tenantId);
  }
}
