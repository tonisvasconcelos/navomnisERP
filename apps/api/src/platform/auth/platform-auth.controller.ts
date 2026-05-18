import { Body, Controller, Get, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { PlatformPublic } from '../decorators/platform-public.decorator';
import { PlatformAuditInterceptor } from '../interceptors/platform-audit.interceptor';
import { PlatformContextInterceptor } from '../interceptors/platform-context.interceptor';
import { PlatformJwtGuard } from './guards/platform-jwt.guard';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { PlatformAuthService } from './platform-auth.service';
import type { PlatformJwtPayload } from './platform-jwt.types';

@ApiTags('platform-auth')
@Controller({ path: 'platform/auth', version: '1' })
@UseInterceptors(PlatformContextInterceptor, PlatformAuditInterceptor)
export class PlatformAuthController {
  constructor(private readonly auth: PlatformAuthService) {}

  @Post('login')
  @PlatformPublic()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login de operador da plataforma' })
  login(@Body() dto: PlatformLoginDto, @Req() req: Request) {
    return this.auth.login(dto, req.ip, req.headers['user-agent'] as string | undefined);
  }

  @Post('refresh')
  @PlatformPublic()
  @ApiOperation({ summary: 'Renovar tokens de plataforma' })
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.auth.refresh(refreshToken);
  }

  @Post('logout')
  @UseGuards(PlatformJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Encerrar sessão de plataforma' })
  logout(@Req() req: Request & { user: PlatformJwtPayload }) {
    return this.auth.logout(req.user.sub);
  }

  @Get('me')
  @UseGuards(PlatformJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perfil do operador de plataforma' })
  me(@Req() req: Request & { user: PlatformJwtPayload }) {
    return this.auth.getMe(req.user.sub);
  }
}
