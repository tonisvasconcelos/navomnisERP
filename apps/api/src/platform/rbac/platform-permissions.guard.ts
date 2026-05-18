import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformPrismaService } from '../../prisma/platform-prisma.service';
import { PLATFORM_PERMISSIONS_KEY } from '../decorators/platform-permissions.decorator';
import type { PlatformJwtPayload } from '../auth/platform-jwt.types';

@Injectable()
export class PlatformPermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PlatformPrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PLATFORM_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) {
      return true;
    }
    const req = context.switchToHttp().getRequest<{ user?: PlatformJwtPayload }>();
    const user = req.user;
    if (!user?.sub || user.ctx !== 'platform') {
      throw new ForbiddenException();
    }
    const links = await this.prisma.platformOperatorRole.findMany({
      where: { operatorId: user.sub },
      include: {
        role: {
          include: {
            rolePermissions: { include: { permission: true } },
          },
        },
      },
    });
    const codes = new Set<string>();
    for (const link of links) {
      for (const rp of link.role.rolePermissions) {
        codes.add(rp.permission.code);
      }
    }
    const ok = required.every((c) => codes.has(c));
    if (!ok) {
      throw new ForbiddenException('Permissão de plataforma insuficiente.');
    }
    return true;
  }
}
