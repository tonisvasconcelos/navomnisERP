import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { PlatformJwtPayload } from '../platform-jwt.types';

@Injectable()
export class PlatformJwtStrategy extends PassportStrategy(Strategy, 'platform-jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('platformJwtAccessSecret'),
    });
  }

  validate(payload: PlatformJwtPayload & { ctx?: string }): PlatformJwtPayload {
    if (payload.ctx !== 'platform') {
      throw new UnauthorizedException('Token de tenant não permitido.');
    }
    return payload;
  }
}
