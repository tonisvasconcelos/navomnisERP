import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BANK_SYNC_QUEUE } from '../banking.constants';
import { BankSyncService } from './bank-sync.service';

export type BankSyncJobPayload = { jobId: string };

@Processor(BANK_SYNC_QUEUE)
export class BankSyncProcessor extends WorkerHost {
  constructor(private readonly sync: BankSyncService) {
    super();
  }

  async process(job: Job<BankSyncJobPayload>): Promise<void> {
    await this.sync.runSyncJob(job.data.jobId);
  }
}
