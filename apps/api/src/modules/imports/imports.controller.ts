import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ImportRowStatus } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../tenant/tenant-access.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermissions } from '../../rbac/permissions.decorator';
import { getTenantContext } from '../../tenant/tenant-storage';
import { ImportsService } from './imports.service';

@ApiTags('imports')
@ApiBearerAuth()
@Controller({ path: 'imports', version: '1' })
@UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post('batches')
  @RequirePermissions('master.write')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: { originalname: string; buffer: Buffer },
    @Body() body: { companyId: string; fileType: string; idempotencyKey: string },
    @Req() _req: Request,
  ) {
    const ctx = getTenantContext();
    if (!ctx) throw new Error('tenant');
    return this.imports.createBatch({
      tenantId: ctx.tenantId,
      companyId: body.companyId,
      fileName: file.originalname,
      fileType: body.fileType,
      idempotencyKey: body.idempotencyKey,
      buffer: file.buffer,
    });
  }

  @Get('batches/:id')
  @RequirePermissions('master.read')
  batch(@Param('id', ParseUUIDPipe) id: string) {
    const ctx = getTenantContext();
    if (!ctx) throw new Error('tenant');
    return this.imports.getBatch(ctx.tenantId, id);
  }

  @Get('batches/:id/rows')
  @RequirePermissions('master.read')
  rows(@Param('id', ParseUUIDPipe) id: string, @Query('status') status?: ImportRowStatus) {
    const ctx = getTenantContext();
    if (!ctx) throw new Error('tenant');
    return this.imports.listRows(ctx.tenantId, id, status);
  }

  @Post('batches/:id/validate')
  @RequirePermissions('master.write')
  validate(@Param('id', ParseUUIDPipe) id: string) {
    const ctx = getTenantContext();
    if (!ctx) throw new Error('tenant');
    return this.imports.validateBatch(ctx.tenantId, id);
  }

  @Post('batches/:id/commit')
  @RequirePermissions('master.write')
  commit(@Param('id', ParseUUIDPipe) id: string) {
    const ctx = getTenantContext();
    if (!ctx) throw new Error('tenant');
    return this.imports.commitBatch(ctx.tenantId, id);
  }
}
