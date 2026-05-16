import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { tenantStorage } from './tenant-storage';

@Injectable()
export class TenantAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: { sub: string; tid?: string } }>();
    const user = req.user;
    if (!user?.tid) {
      throw new ForbiddenException('Tenant não informado no token.');
    }
    tenantStorage.enterWith({ tenantId: user.tid, userId: user.sub });

    const link = await this.prisma.userTenant.findFirst({
      where: { userId: user.sub, tenantId: user.tid },
    });
    if (!link) {
      throw new ForbiddenException('Usuário sem acesso a este tenant.');
    }
    return true;
  }
}
