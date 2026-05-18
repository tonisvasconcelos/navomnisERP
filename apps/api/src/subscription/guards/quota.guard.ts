import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { QuotaResource } from '@prisma/client';
import { REQUIRED_QUOTA_KEY } from '../decorators/required-quota.decorator';
import { SubscriptionEnforcementService } from '../subscription-enforcement.service';

@Injectable()
export class QuotaGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly enforcement: SubscriptionEnforcementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.getAllAndOverride<QuotaResource>(REQUIRED_QUOTA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!resource) {
      return true;
    }
    const req = context.switchToHttp().getRequest<{ user?: { tid?: string } }>();
    const tenantId = req.user?.tid;
    if (!tenantId) {
      return true;
    }
    const check = await this.enforcement.checkQuota(tenantId, resource);
    if (!check.ok) {
      throw new ForbiddenException(
        `Cota excedida para ${resource}: ${check.used}/${check.limit}`,
      );
    }
    return true;
  }
}
