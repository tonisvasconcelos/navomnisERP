import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_MODULE_KEY } from '../decorators/required-module.decorator';
import { SubscriptionEnforcementService } from '../subscription-enforcement.service';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly enforcement: SubscriptionEnforcementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduleKey = this.reflector.getAllAndOverride<string>(REQUIRED_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!moduleKey) {
      return true;
    }
    const req = context.switchToHttp().getRequest<{ user?: { tid?: string } }>();
    const tenantId = req.user?.tid;
    if (!tenantId) {
      return true;
    }
    const gate = await this.enforcement.getTenantGate(tenantId);
    if (!gate.allowed || !gate.tenant) {
      throw new ForbiddenException('Módulo indisponível para este tenant.');
    }
    const features = gate.subscription?.plan.features ?? [];
    const overrides = gate.tenant.featureOverrides ?? [];
    if (!this.enforcement.isModuleEnabled(moduleKey, features, overrides)) {
      throw new ForbiddenException(`Módulo "${moduleKey}" não incluído no plano.`);
    }
    return true;
  }
}
