import { SetMetadata } from '@nestjs/common';
import type { QuotaResource } from '@prisma/client';

export const REQUIRED_QUOTA_KEY = 'requiredQuota';
export const RequiresQuota = (resource: QuotaResource) => SetMetadata(REQUIRED_QUOTA_KEY, resource);
