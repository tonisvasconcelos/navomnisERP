import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OpenFinanceEnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    const enabled =
      this.config.get<string>('openFinance.enabled') === 'true' ||
      process.env.OPEN_FINANCE_ENABLED === 'true';
    if (!enabled) {
      throw new NotFoundException('Open Finance não está habilitado neste ambiente.');
    }
    return true;
  }
}
