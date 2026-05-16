import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS_KEY } from './permissions.decorator';

type UserRoleWithRole = Prisma.UserRoleGetPayload<{ include: { role: true } }>;

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) {
      return true;
    }
    const req = context.switchToHttp().getRequest<{
      user?: { sub: string; tid: string };
    }>();
    const user = req.user;
    if (!user?.tid) {
      throw new ForbiddenException();
    }
    const userRoles: UserRoleWithRole[] = await this.prisma.userRole.findMany({
      where: { userId: user.sub },
      include: { role: true },
    });
    const roleIds = userRoles.filter((ur) => ur.role.tenantId === user.tid).map((ur) => ur.roleId);
    if (!roleIds.length) {
      throw new ForbiddenException('Sem permissões neste tenant.');
    }
    const links = await this.prisma.rolePermission.findMany({
      where: { roleId: { in: roleIds } },
      include: { permission: true },
    });
    type Link = Prisma.RolePermissionGetPayload<{ include: { permission: true } }>;
    const codes = new Set(links.map((l: Link) => l.permission.code));
    const ok = required.every((c) => codes.has(c));
    if (!ok) {
      throw new ForbiddenException('Permissão insuficiente.');
    }
    return true;
  }
}
