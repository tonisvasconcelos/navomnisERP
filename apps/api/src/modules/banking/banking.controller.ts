import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../rbac/permissions.decorator';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { TenantAccessGuard } from '../../tenant/tenant-access.guard';
import { OpenFinanceInstitutionsService } from './open-finance/open-finance-institutions.service';
import { BankConnectionsService } from './connections/bank-connections.service';
import { ConsentOAuthService } from './consent/consent-oauth.service';
import { BankSyncService } from './sync/bank-sync.service';
import { ReconciliationService } from './reconciliation/reconciliation.service';
import { BankingDashboardService } from './dashboard/banking-dashboard.service';
import { PixService } from './pix/pix.service';
import {
  ConfirmMatchDto,
  ListTransactionsQueryDto,
  StartConnectionDto,
  SuggestReconciliationDto,
} from './dto/banking.dto';
import { OpenFinanceEnabledGuard } from './guards/open-finance-enabled.guard';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BANK_SYNC_QUEUE, type BankSyncJobPayload } from './banking.constants';

@ApiTags('banking')
@Controller({ path: 'banking', version: '1' })
@UseGuards(OpenFinanceEnabledGuard, JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
export class BankingController {
  constructor(
    private readonly institutions: OpenFinanceInstitutionsService,
    private readonly connections: BankConnectionsService,
    private readonly consentOAuth: ConsentOAuthService,
    private readonly sync: BankSyncService,
    private readonly reconciliation: ReconciliationService,
    private readonly dashboard: BankingDashboardService,
    private readonly pix: PixService,
    @InjectQueue(BANK_SYNC_QUEUE) private readonly syncQueue: Queue<BankSyncJobPayload>,
  ) {}

  @Get('institutions')
  @RequirePermissions('banking.read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar instituições Open Finance (sandbox)' })
  listInstitutions() {
    return this.institutions.listActive();
  }

  @Get('connections')
  @RequirePermissions('banking.read')
  @ApiBearerAuth()
  listConnections(@Query('companyId', ParseUUIDPipe) companyId: string) {
    return this.connections.list(companyId);
  }

  @Post('connections')
  @RequirePermissions('banking.connect')
  @ApiBearerAuth()
  startConnection(@Body() dto: StartConnectionDto, @Req() req: Request) {
    const userId = (req.user as { sub: string }).sub;
    return this.connections.startConnection(dto.companyId, dto.institutionId, userId);
  }

  @Post('consents/:id/revoke')
  @RequirePermissions('banking.connect')
  @ApiBearerAuth()
  revokeConsent(@Param('id', ParseUUIDPipe) id: string) {
    return this.consentOAuth.revokeConsent(id);
  }

  @Get('accounts')
  @RequirePermissions('banking.read')
  @ApiBearerAuth()
  accounts(@Query('companyId', ParseUUIDPipe) companyId: string) {
    return this.sync.listAccounts(companyId);
  }

  @Post('accounts/:connectionId/sync')
  @RequirePermissions('banking.admin')
  @ApiBearerAuth()
  async triggerSync(@Param('connectionId', ParseUUIDPipe) connectionId: string) {
    const { jobId } = await this.sync.enqueueAccountSync(connectionId);
    await this.syncQueue.add('sync', { jobId }, { removeOnComplete: 100 });
    return { jobId, queued: true };
  }

  @Get('transactions')
  @RequirePermissions('banking.read')
  @ApiBearerAuth()
  transactions(@Query() query: ListTransactionsQueryDto) {
    return this.sync.listTransactions(query.companyId, {
      accountId: query.accountId,
      from: query.from,
      to: query.to,
      transactionType: query.transactionType,
      endToEndId: query.endToEndId,
    });
  }

  @Get('pix')
  @RequirePermissions('banking.read')
  @ApiBearerAuth()
  pixTransactions(
    @Query('companyId', ParseUUIDPipe) companyId: string,
    @Query('endToEndId') endToEndId?: string,
  ) {
    return this.pix.listPix(companyId, endToEndId);
  }

  @Get('dashboard/summary')
  @RequirePermissions('banking.read')
  @ApiBearerAuth()
  summary(@Query('companyId', ParseUUIDPipe) companyId: string) {
    return this.dashboard.summary(companyId);
  }

  @Get('reconciliation/suggestions')
  @RequirePermissions('banking.reconcile')
  @ApiBearerAuth()
  suggestions(@Query() query: SuggestReconciliationDto) {
    return this.reconciliation.suggest(query.companyId, query.bankTransactionId);
  }

  @Post('reconciliation/suggest-persist')
  @RequirePermissions('banking.reconcile')
  @ApiBearerAuth()
  persistSuggestions(@Body() dto: SuggestReconciliationDto) {
    return this.reconciliation.persistSuggestions(dto.companyId, dto.bankTransactionId);
  }

  @Post('matches/:id/confirm')
  @RequirePermissions('banking.reconcile')
  @ApiBearerAuth()
  confirmMatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmMatchDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as { sub: string }).sub;
    return this.reconciliation.confirmMatch(id, dto.companyId, userId);
  }
}
