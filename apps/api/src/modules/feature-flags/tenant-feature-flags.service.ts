import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export type TenantFeatureFlag =
  | 'uom_enforcement'
  | 'po_approval_required'
  | 'fefo_sales';

@Injectable()
export class TenantFeatureFlagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async isEnabled(tenantId: string, flag: TenantFeatureFlag): Promise<boolean> {
    const override = await this.prisma.tenantFeatureOverride.findUnique({
      where: { tenantId_moduleKey: { tenantId, moduleKey: flag } },
    });
    if (override) return override.enabled;
    const defaults = this.config.get<{ uomEnforcementDefault: string }>('featureFlags');
    if (flag === 'uom_enforcement') {
      return defaults?.uomEnforcementDefault === 'true';
    }
    if (flag === 'po_approval_required') {
      return this.config.get<string>('featureFlags.poApprovalRequiredDefault') === 'true';
    }
    if (flag === 'fefo_sales') {
      return this.config.get<string>('featureFlags.fefoSalesDefault') === 'true';
    }
    return false;
  }
}
