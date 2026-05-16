import { Body, Controller, Get, Headers, HttpCode, Ip, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { TenantAccessGuard } from '../tenant/tenant-access.guard';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({ summary: 'Login com e-mail e senha' })
  login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    return this.auth.login(dto, ip, userAgent);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Renovar tokens' })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revogar todas as sessões (refresh tokens) do utilizador' })
  logout(@Req() req: Request & { user: { sub: string } }) {
    return this.auth.revokeAllRefreshTokens(req.user.sub);
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Cadastro inicial (desabilitado em produção)' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Get('me')
  @UseGuards(TenantAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perfil do usuário autenticado e permissões no tenant atual' })
  me(@Req() req: Request & { user: { sub: string; email: string; tid: string } }) {
    return this.auth.getMeProfile(req.user.sub, req.user.tid);
  }
}
