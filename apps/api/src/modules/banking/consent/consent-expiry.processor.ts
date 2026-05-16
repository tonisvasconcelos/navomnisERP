import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BANK_CONSENT_QUEUE } from '../banking.constants';
import { ConsentOAuthService } from './consent-oauth.service';

@Processor(BANK_CONSENT_QUEUE)
export class ConsentExpiryProcessor extends WorkerHost {
  constructor(private readonly consentOAuth: ConsentOAuthService) {
    super();
  }

  async process(_job: Job): Promise<{ expired: number }> {
    const expired = await this.consentOAuth.expireStaleConsents();
    return { expired };
  }
}
