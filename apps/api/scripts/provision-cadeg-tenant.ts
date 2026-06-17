import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CadegMasterDataService } from '../src/modules/cadeg/cadeg-master-data.service';

async function main() {
  const tenantId = process.argv.find((a) => a.startsWith('--tenant-id='))?.split('=')[1];
  const dataDir = process.argv.find((a) => a.startsWith('--data-dir='))?.split('=')[1];
  const stage = process.argv.includes('--stage-transactions');

  if (!tenantId) {
    console.error('Usage: provision:cadeg -- --tenant-id=<uuid> [--data-dir=path] [--stage-transactions]');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  try {
    const cadeg = app.get(CadegMasterDataService);
    const result = await cadeg.provisionTenant(tenantId, {
      dataDir,
      stageTransactions: stage,
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
