import './env-bootstrap';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as Sentry from '@sentry/node';
import { getProcessRole } from './config/env.schema';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  if (getProcessRole() !== 'worker') {
    // eslint-disable-next-line no-console
    console.error('PROCESS_ROLE deve ser "worker" para worker.main (defina PROCESS_ROLE=worker).');
    process.exit(1);
  }

  if (process.env.SENTRY_DSN_API) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN_API,
      tracesSampleRate: 0.05,
      environment: process.env.NODE_ENV ?? 'development',
    });
  }

  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['error', 'warn', 'log'],
  });
  await app.init();
  const logger = new Logger('WorkerBootstrap');
  logger.log('Worker BullMQ iniciado (fila notifications).');
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
