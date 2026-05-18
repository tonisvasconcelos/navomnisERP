import { createHash, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PlatformPrismaService } from '../../prisma/platform-prisma.service';
import type { PlatformLoginDto } from './dto/platform-login.dto';
import type { PlatformJwtPayload } from './platform-jwt.types';

@Injectable()
export class PlatformAuthService {
  constructor(
    private readonly prisma: PlatformPrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: PlatformLoginDto, ip?: string, userAgent?: string) {
    const email = dto.email.toLowerCase();
    const operator = await this.prisma.platformOperator.findUnique({ where: { email } });
    if (!operator?.passwordHash || operator.blockedAt) {
      if (operator) {
        await this.prisma.platformLoginHistory.create({
          data: { operatorId: operator.id, ip, userAgent, success: false, reason: 'blocked_or_no_password' },
        });
      }
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    const ok = await argon2.verify(operator.passwordHash, dto.password);
    if (!ok) {
      await this.prisma.platformLoginHistory.create({
        data: { operatorId: operator.id, ip, userAgent, success: false, reason: 'invalid_password' },
      });
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    await this.prisma.platformLoginHistory.create({
      data: { operatorId: operator.id, ip, userAgent, success: true },
    });
    const fingerprint = deviceFingerprint(userAgent, ip);
    await this.prisma.platformSession.create({
      data: { operatorId: operator.id, deviceFingerprint: fingerprint, ip, userAgent },
    });
    return this.issueTokens(operator.id, operator.email, ip, userAgent);
  }

  async refresh(refreshToken: string) {
    const secret = this.config.get<string>('platformJwtRefreshSecret') ?? 'dev';
    let payload: { sub: string; jti: string; ctx?: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, { secret });
    } catch {
      throw new UnauthorizedException('Refresh expirado ou inválido.');
    }
    if (payload.ctx !== 'platform') {
      throw new UnauthorizedException('Refresh inválido.');
    }
    const row = await this.prisma.platformRefreshToken.findUnique({ where: { jti: payload.jti } });
    if (!row || row.operatorId !== payload.sub || row.revokedAt) {
      throw new UnauthorizedException('Refresh inválido.');
    }
    const valid = await argon2.verify(row.hashedToken, refreshToken);
    if (!valid || row.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh expirado ou inválido.');
    }
    await this.prisma.platformRefreshToken.update({
      where: { jti: payload.jti },
      data: { revokedAt: new Date() },
    });
    const operator = await this.prisma.platformOperator.findUniqueOrThrow({ where: { id: payload.sub } });
    return this.issueTokens(operator.id, operator.email);
  }

  async logout(operatorId: string, jti?: string) {
    if (jti) {
      await this.prisma.platformRefreshToken.updateMany({
        where: { operatorId, jti, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.platformRefreshToken.updateMany({
        where: { operatorId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.prisma.platformSession.updateMany({
      where: { operatorId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getMe(operatorId: string) {
    const operator = await this.prisma.platformOperator.findUnique({
      where: { id: operatorId },
      select: { id: true, email: true, displayName: true, mfaEnabled: true },
    });
    if (!operator) {
      throw new UnauthorizedException('Sessão inválida.');
    }
    const permissions = await this.resolvePermissions(operatorId);
    return { ...operator, sub: operator.id, permissions };
  }

  private async resolvePermissions(operatorId: string): Promise<string[]> {
    const links = await this.prisma.platformOperatorRole.findMany({
      where: { operatorId },
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
    return [...codes].sort();
  }

  private async issueTokens(operatorId: string, email: string, ip?: string, userAgent?: string) {
    const accessSecret = this.config.getOrThrow<string>('platformJwtAccessSecret');
    const refreshSecret = this.config.get<string>('platformJwtRefreshSecret') ?? 'dev';
    const refreshExpires = this.config.get<string>('platformJwtRefreshExpires') ?? '7d';
    const payload: PlatformJwtPayload = { sub: operatorId, email, ctx: 'platform' };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: accessSecret,
      expiresIn: this.config.get<string>('platformJwtAccessExpires') ?? '15m',
    });
    const jti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: operatorId, jti, ctx: 'platform' },
      { secret: refreshSecret, expiresIn: refreshExpires },
    );
    const hashed = await argon2.hash(refreshToken);
    const expiresMs = 7 * 24 * 60 * 60 * 1000;
    await this.prisma.platformRefreshToken.create({
      data: {
        operatorId,
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
    };
  }
}

function deviceFingerprint(userAgent?: string, ip?: string): string {
  const raw = `${userAgent ?? ''}|${ip ?? ''}`;
  return createHash('sha256').update(raw).digest('hex').slice(0, 32);
}
