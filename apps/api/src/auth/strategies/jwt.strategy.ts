import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtAccessPayload } from '../jwt.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwtAccessSecret'),
    });
  }

  async validate(payload: JwtAccessPayload & { ctx?: string }): Promise<JwtAccessPayload> {
    if ((payload as { ctx?: string }).ctx === 'platform') {
      throw new UnauthorizedException('Token de plataforma não permitido nesta API.');
    }
    return { ...payload, ctx: 'tenant' };
  }
}
