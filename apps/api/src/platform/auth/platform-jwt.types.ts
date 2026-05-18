export type PlatformJwtPayload = {
  sub: string;
  email: string;
  ctx: 'platform';
  jti?: string;
};
