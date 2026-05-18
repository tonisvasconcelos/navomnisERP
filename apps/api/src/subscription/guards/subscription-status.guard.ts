import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { SKIP_SUBSCRIPTION_KEY } from '../decorators/skip-subscription.decorator';
import { SubscriptionEnforcementService } from '../subscription-enforcement.service';

@Injectable()
export class SubscriptionStatusGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly enforcement: SubscriptionEnforcementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_SUBSCRIPTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return true;
    }
    const req = context.switchToHttp().getRequest<{ user?: { tid?: string; ctx?: string }; path?: string }>();
    if (req.path?.includes('/platform/') || req.user?.ctx === 'platform') {
      return true;
    }
    const tenantId = req.user?.tid;
    if (!tenantId) {
      return true;
    }
    const gate = await this.enforcement.getTenantGate(tenantId);
    if (!gate.allowed) {
      throw new ForbiddenException(`Acesso bloqueado: ${gate.reason}`);
    }
    return true;
  }
}
