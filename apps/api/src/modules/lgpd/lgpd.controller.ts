import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../tenant/tenant-access.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { ConsentDto } from './dto/consent.dto';

@ApiTags('lgpd')
@ApiBearerAuth()
@Controller({ path: 'lgpd', version: '1' })
@UseGuards(JwtAuthGuard, TenantAccessGuard)
export class LgpdController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('consents')
  @ApiOperation({ summary: 'Histórico de consentimentos do usuário' })
  consents(@Req() req: Request & { user: { sub: string } }) {
    return this.prisma.consentRecord.findMany({
      where: { userId: req.user.sub },
      orderBy: { acceptedAt: 'desc' },
    });
  }

  @Post('consents')
  @ApiOperation({ summary: 'Registrar aceite de documento legal' })
  record(@Req() req: Request & { user: { sub: string } }, @Body() dto: ConsentDto) {
    return this.prisma.consentRecord.create({
      data: {
        userId: req.user.sub,
        kind: dto.kind,
        version: dto.version,
      },
    });
  }
}
