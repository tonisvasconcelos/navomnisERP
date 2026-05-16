import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../auth/decorators/public.decorator';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BANK_SYNC_QUEUE, type BankSyncJobPayload } from './banking.constants';
import { ConsentOAuthService } from './consent/consent-oauth.service';
import { BankSyncService } from './sync/bank-sync.service';
import { OpenFinanceEnabledGuard } from './guards/open-finance-enabled.guard';

@ApiTags('banking')
@Controller({ path: 'banking/oauth', version: '1' })
@UseGuards(OpenFinanceEnabledGuard)
export class BankingOAuthController {
  constructor(
    private readonly consentOAuth: ConsentOAuthService,
    private readonly sync: BankSyncService,
    @InjectQueue(BANK_SYNC_QUEUE) private readonly syncQueue: Queue<BankSyncJobPayload>,
  ) {}

  @Public()
  @Get('callback')
  @ApiOperation({ summary: 'Callback OAuth Open Finance (servidor, sem JWT)' })
  async oauthCallback(
    @Query('state') state: string,
    @Query('code') code: string,
    @Res() res: Response,
  ) {
    const result = await this.consentOAuth.handleCallback(state, code);
    const consent = await this.consentOAuth.getConsentWithConnection(result.consentId);
    if (consent) {
      const { jobId } = await this.sync.enqueueAccountSync(
        consent.connectionId,
        consent.id,
        consent.tenantId,
      );
      await this.syncQueue.add('sync', { jobId }, { removeOnComplete: 100 });
    }
    const webUrl = process.env.WEB_URL ?? 'http://localhost:5173';
    res.redirect(`${webUrl}/banking/connect?consentId=${result.consentId}&status=authorised`);
  }
}
