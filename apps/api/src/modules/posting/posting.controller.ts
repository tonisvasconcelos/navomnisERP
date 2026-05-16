import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../tenant/tenant-access.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermissions } from '../../rbac/permissions.decorator';
import { PostingPreviewDto } from './dto/posting-preview.dto';
import { PostingService } from './posting.service';

@ApiTags('posting')
@ApiBearerAuth()
@Controller({ path: 'posting', version: '1' })
@UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
export class PostingController {
  constructor(private readonly posting: PostingService) {}

  @Post('preview')
  @RequirePermissions('finance.read')
  @ApiOperation({ summary: 'Prévia de lançamento contábil antes de postar' })
  preview(@Body() dto: PostingPreviewDto) {
    return this.posting.preview(dto);
  }
}
