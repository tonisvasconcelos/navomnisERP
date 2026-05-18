import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { PLATFORM_PUBLIC_KEY } from '../../decorators/platform-public.decorator';

@Injectable()
export class PlatformJwtGuard extends AuthGuard('platform-jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PLATFORM_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context) as Promise<boolean>;
  }

  handleRequest<TUser>(err: Error | undefined, user: TUser | false): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Token de plataforma inválido ou ausente.');
    }
    return user;
  }
}
