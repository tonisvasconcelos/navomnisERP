import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { JwtAccessPayload } from './jwt.types';

export type { JwtAccessPayload };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async getMeProfile(userId: string, tenantId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, displayName: true },
    });
    if (!user) {
      throw new UnauthorizedException('Sessão inválida.');
    }
    const permissions = await this.resolvePermissionCodes(userId, tenantId);
    return {
      sub: user.id,
      email: user.email,
      displayName: user.displayName,
      tenantId,
      permissions,
    };
  }

  private async resolvePermissionCodes(userId: string, tenantId: string): Promise<string[]> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    const roleIds = userRoles.filter((ur) => ur.role.tenantId === tenantId).map((ur) => ur.roleId);
    if (!roleIds.length) {
      return [];
    }
    const links = await this.prisma.rolePermission.findMany({
      where: { roleId: { in: roleIds } },
      include: { permission: true },
    });
    const codes = new Set(links.map((l) => l.permission.code));
    return [...codes].sort();
  }

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) {
      await this.prisma.accessLog.create({
        data: {
          userId: user.id,
          ip,
          userAgent,
          success: false,
          reason: 'invalid_password',
        },
      });
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    const tenantLink = await this.resolveTenantLink(user.id, dto.tenantSlug);
    await this.prisma.accessLog.create({
      data: {
        userId: user.id,
        ip,
        userAgent,
        success: true,
      },
    });
    return this.issueTokens(user.id, user.email, tenantLink.tenantId, ip, userAgent);
  }

  private async resolveTenantLink(userId: string, tenantSlug?: string) {
    if (tenantSlug) {
      const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (!tenant) {
        throw new UnauthorizedException('Tenant não encontrado.');
      }
      const link = await this.prisma.userTenant.findFirst({
        where: { userId, tenantId: tenant.id },
      });
      if (!link) {
        throw new UnauthorizedException('Sem acesso a este tenant.');
      }
      return link;
    }
    const link = await this.prisma.userTenant.findFirst({
      where: { userId, isDefault: true },
    });
    if (!link) {
      const any = await this.prisma.userTenant.findFirst({ where: { userId } });
      if (!any) {
        throw new UnauthorizedException('Usuário sem tenant associado.');
      }
      return any;
    }
    return link;
  }

  private async issueTokens(
    userId: string,
    email: string,
    tenantId: string,
    ip?: string,
    userAgent?: string,
  ) {
    const payload: JwtAccessPayload = { sub: userId, email, tid: tenantId };
    const accessToken = await this.jwt.signAsync(payload);
    const jti = randomUUID();
    const refreshSecret = this.config.get<string>('jwtRefreshSecret') ?? 'dev';
    const refreshExpires = this.config.get<string>('jwtRefreshExpires') ?? '7d';
    const expiresMs = jwtExpiresInToMs(refreshExpires);
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, tid: tenantId, jti },
      {
        secret: refreshSecret,
        expiresIn: refreshExpires,
      },
    );
    const hashed = await argon2.hash(refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        jti,
        hashedToken: hashed,
        ip,
        userAgent,
        expiresAt: new Date(Date.now() + expiresMs),
      },
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      tokenType: 'Bearer',
      tenantId,
    };
  }

  async refresh(refreshToken: string) {
    const refreshSecret = this.config.get<string>('jwtRefreshSecret') ?? 'dev';
    let payload: { sub: string; tid: string; jti: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string; tid: string; jti: string }>(
        refreshToken,
        { secret: refreshSecret },
      );
    } catch {
      throw new UnauthorizedException('Refresh expirado ou inválido.');
    }
    const { sub: userId, tid: tenantId, jti } = payload;
    const row = await this.prisma.refreshToken.findUnique({ where: { jti } });
    if (!row || row.userId !== userId || row.revokedAt) {
      throw new UnauthorizedException('Refresh inválido.');
    }
    const valid = await argon2.verify(row.hashedToken, refreshToken);
    if (!valid) {
      throw new UnauthorizedException('Refresh inválido.');
    }
    if (row.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh expirado ou inválido.');
    }
    await this.prisma.refreshToken.update({
      where: { jti },
      data: { revokedAt: new Date() },
    });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.issueTokens(user.id, user.email, tenantId);
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async register(dto: RegisterDto) {
    if (this.config.get('nodeEnv') === 'production') {
      throw new UnauthorizedException('Cadastro público desabilitado.');
    }
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new UnauthorizedException('E-mail já cadastrado.');
    }
    const passwordHash = await argon2.hash(dto.password);
    const tenant = await this.prisma.tenant.create({
      data: {
        slug: dto.tenantSlug,
        name: dto.tenantName,
        status: 'ACTIVE',
        branding: { create: {} },
      },
    });
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        displayName: dto.displayName,
      },
    });
    await this.prisma.userTenant.create({
      data: { userId: user.id, tenantId: tenant.id, isDefault: true },
    });
    const adminRole = await this.prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: 'Administrador',
        description: 'Acesso total ao tenant',
      },
    });
    const perms = await this.prisma.permission.findMany();
    for (const p of perms) {
      await this.prisma.rolePermission.create({
        data: { roleId: adminRole.id, permissionId: p.id },
      });
    }
    await this.prisma.userRole.create({
      data: { userId: user.id, roleId: adminRole.id },
    });
    await this.prisma.company.create({
      data: {
        tenantId: tenant.id,
        name: 'Matriz',
        isHead: true,
      },
    });
    return { userId: user.id, tenantId: tenant.id };
  }
}

function jwtExpiresInToMs(expr: string): number {
  const s = expr.trim().replace(/\s+/g, '');
  const m = /^(\d+)(ms|[dhms])$/i.exec(s);
  if (!m) {
    return 7 * 24 * 60 * 60 * 1000;
  }
  const n = parseInt(m[1], 10);
  const u = m[2].toLowerCase();
  if (u === 'ms') {
    return n;
  }
  if (u === 's') {
    return n * 1000;
  }
  if (u === 'm') {
    return n * 60 * 1000;
  }
  if (u === 'h') {
    return n * 60 * 60 * 1000;
  }
  if (u === 'd') {
    return n * 24 * 60 * 60 * 1000;
  }
  return 7 * 24 * 60 * 60 * 1000;
}
