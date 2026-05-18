import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType } from '@prisma/client';
import * as argon2 from 'argon2';
import { NotificationsService } from '../../modules/notifications/notifications.service';
import { PlatformPrismaService } from '../../prisma/platform-prisma.service';
import { getPlatformContext } from '../platform-storage';
import type { InvitePlatformUserDto } from './dto/invite-platform-user.dto';
import type { UpdatePlatformUserDto } from './dto/update-platform-user.dto';
import { generateInviteToken, hashInviteToken } from './user-invite.util';

const INVITE_DAYS = 7;

@Injectable()
export class PlatformUsersService {
  constructor(
    private readonly prisma: PlatformPrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  list(params: { search?: string; tenantId?: string; skip?: number; take?: number }) {
    const where = {
      deletedAt: null,
      ...(params.search
        ? {
            OR: [
              { email: { contains: params.search, mode: 'insensitive' as const } },
              { displayName: { contains: params.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(params.tenantId
        ? { userTenants: { some: { tenantId: params.tenantId } } }
        : {}),
    };
    return this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: params.skip ?? 0,
        take: params.take ?? 50,
        orderBy: { createdAt: 'desc' },
        include: {
          userTenants: { include: { tenant: true } },
          userInvites: {
            where: { acceptedAt: null, expiresAt: { gt: new Date() } },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
  }

  listInvites(params: { tenantId?: string; skip?: number; take?: number }) {
    const where = {
      acceptedAt: null,
      expiresAt: { gt: new Date() },
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
    };
    return this.prisma.$transaction([
      this.prisma.userInvite.findMany({
        where,
        skip: params.skip ?? 0,
        take: params.take ?? 50,
        orderBy: { createdAt: 'desc' },
        include: { tenant: true, user: true },
      }),
      this.prisma.userInvite.count({ where }),
    ]);
  }

  get(id: string) {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        userTenants: { include: { tenant: true } },
        userInvites: { orderBy: { createdAt: 'desc' }, take: 5, include: { tenant: true } },
        loginHistories: { orderBy: { createdAt: 'desc' }, take: 20 },
        devices: { orderBy: { lastSeenAt: 'desc' } },
      },
    });
  }

  async update(id: string, dto: UpdatePlatformUserDto) {
    await this.ensureUser(id);
    return this.prisma.user.update({
      where: { id },
      data: {
        displayName: dto.displayName,
        locale: dto.locale,
      },
    });
  }

  async invite(dto: InvitePlatformUserDto) {
    const email = dto.email.toLowerCase().trim();
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: dto.tenantId, deletedAt: null },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado.');
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing?.passwordHash) {
      throw new ConflictException('E-mail já está em uso.');
    }

    const token = generateInviteToken();
    const tokenHash = hashInviteToken(token);
    const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);
    const invitedById = getPlatformContext()?.operatorId;

    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: { displayName: dto.displayName },
        })
      : await this.prisma.user.create({
          data: {
            email,
            displayName: dto.displayName,
            passwordHash: null,
          },
        });

    await this.prisma.userTenant.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
      create: { userId: user.id, tenantId: tenant.id, isDefault: true },
      update: {},
    });

    await this.assignDefaultRole(user.id, tenant.id);

    await this.prisma.userInvite.deleteMany({
      where: { userId: user.id, tenantId: tenant.id, acceptedAt: null },
    });

    const invite = await this.prisma.userInvite.create({
      data: {
        userId: user.id,
        email,
        displayName: dto.displayName,
        tenantId: tenant.id,
        tokenHash,
        expiresAt,
        invitedById,
      },
    });

    const webUrl = this.config.get<string>('webUrl') ?? 'http://localhost:5173';
    const inviteUrl = `${webUrl.replace(/\/$/, '')}/invite/accept?token=${encodeURIComponent(token)}`;

    await this.notifications.createInAppAndEmail({
      tenantId: tenant.id,
      userId: user.id,
      type: NotificationType.PASSWORD_RESET,
      title: 'Convite Navomnis',
      body: 'Complete o seu cadastro definindo uma senha.',
      toEmail: email,
      emailSubject: 'Convite para aceder ao Navomnis',
      emailHtml: `<p>Olá ${dto.displayName},</p><p>Foi convidado para o tenant <strong>${tenant.name}</strong>.</p><p><a href="${inviteUrl}">Aceitar convite e definir senha</a></p><p>O link expira em ${INVITE_DAYS} dias.</p>`,
    });

    return { user, invite, inviteUrl, token };
  }

  async block(id: string) {
    await this.ensureUser(id);
    return this.prisma.user.update({ where: { id }, data: { blockedAt: new Date() } });
  }

  async unblock(id: string) {
    await this.ensureUser(id);
    return this.prisma.user.update({ where: { id }, data: { blockedAt: null } });
  }

  async forcePasswordReset(id: string) {
    await this.ensureUser(id);
    return this.prisma.user.update({
      where: { id },
      data: { forcePasswordResetAt: new Date() },
    });
  }

  async assignTenant(userId: string, tenantId: string, isDefault = false) {
    await this.ensureUser(userId);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado.');
    }
    return this.prisma.userTenant.upsert({
      where: { userId_tenantId: { userId, tenantId } },
      create: { userId, tenantId, isDefault },
      update: { isDefault },
    });
  }

  async revokeSessions(userId: string) {
    await this.ensureUser(userId);
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  }

  private async assignDefaultRole(userId: string, tenantId: string) {
    const role =
      (await this.prisma.role.findFirst({
        where: { tenantId, name: { in: ['Utilizador', 'User', 'Operador'] } },
      })) ??
      (await this.prisma.role.findFirst({
        where: { tenantId, NOT: { name: 'Administrador' } },
        orderBy: { name: 'asc' },
      }));
    if (!role) {
      return;
    }
    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      create: { userId, roleId: role.id },
      update: {},
    });
  }

  private async ensureUser(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) {
      throw new NotFoundException('Usuário não encontrado.');
    }
  }
}
