import { SetMetadata } from '@nestjs/common';

export const PLATFORM_PERMISSIONS_KEY = 'platformPermissions';
export const PlatformPermissions = (...codes: string[]) =>
  SetMetadata(PLATFORM_PERMISSIONS_KEY, codes);
