import { SetMetadata } from '@nestjs/common';

export const PLATFORM_PUBLIC_KEY = 'platformPublic';
export const PlatformPublic = () => SetMetadata(PLATFORM_PUBLIC_KEY, true);
