import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApprovalDocumentType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../tenant/tenant-access.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermissions } from '../../rbac/permissions.decorator';
import { ApprovalsService } from './approvals.service';
import {
  ApprovalActionDto,
  CreateApprovalPolicyDto,
  CreateApprovalPolicyStepDto,
} from './dto/approval.dto';

@ApiTags('approvals')
@ApiBearerAuth()
@Controller({ path: 'approvals', version: '1' })
@UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get('inbox')
  @RequirePermissions('approvals.read')
  inbox() {
    return this.approvals.inbox();
  }

  @Get('history')
  @RequirePermissions('approvals.read')
  history(
    @Query('documentType') documentType: ApprovalDocumentType,
    @Query('documentId') documentId: string,
  ) {
    return this.approvals.history(documentType, documentId);
  }

  @Get('policies')
  @RequirePermissions('approvals.configure')
  policies() {
    return this.approvals.listPolicies();
  }

  @Post('policies')
  @RequirePermissions('approvals.configure')
  createPolicy(
    @Body() body: CreateApprovalPolicyDto & { steps: CreateApprovalPolicyStepDto[] },
  ) {
    const { steps, ...dto } = body;
    return this.approvals.createPolicy(dto, steps ?? []);
  }
}

export { ApprovalActionDto };
