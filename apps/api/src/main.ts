import './env-bootstrap';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as Sentry from '@sentry/node';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { getProcessRole } from './config/env.schema';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

function corsOrigin(): boolean | string[] {
  const isProd = process.env.NODE_ENV === 'production';
  const raw = process.env.WEB_URL ?? '';
  const origins = raw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  if (isProd) {
    return origins.length > 0 ? origins : [];
  }
  return origins.length > 0 ? origins : true;
}

async function bootstrap() {
  if (getProcessRole() === 'worker') {
    // eslint-disable-next-line no-console
    console.error('PROCESS_ROLE=worker: use `node dist/worker.main` (ou pnpm start:worker), não o HTTP main.');
    process.exit(1);
  }

  if (process.env.SENTRY_DSN_API) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN_API,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV ?? 'development',
    });
  }

  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: false });
  app.useLogger(app.get(Logger));

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: corsOrigin(),
    credentials: true,
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const isProd = process.env.NODE_ENV === 'production';
  const swaggerFlag = process.env.SWAGGER_ENABLED === 'true';
  const swaggerBasicUser = process.env.SWAGGER_BASIC_USER?.trim();
  const swaggerBasicPass = process.env.SWAGGER_BASIC_PASSWORD?.trim();
  const swaggerEnabled = isProd
    ? swaggerFlag && Boolean(swaggerBasicUser && swaggerBasicPass)
    : process.env.SWAGGER_ENABLED !== 'false';

  if (swaggerEnabled) {
    if (isProd && swaggerBasicUser && swaggerBasicPass) {
      const http = app.getHttpAdapter().getInstance();
      http.use('/api/docs', (req: { headers: { authorization?: string } }, res: { setHeader: (k: string, v: string) => void; status: (n: number) => { end: () => void } }, next: () => void) => {
        const header = req.headers.authorization ?? '';
        const expected = `Basic ${Buffer.from(`${swaggerBasicUser}:${swaggerBasicPass}`).toString('base64')}`;
        if (header === expected) {
          next();
          return;
        }
        res.setHeader('WWW-Authenticate', 'Basic realm="Navomnis API docs"');
        res.status(401).end();
      });
      http.use('/api/docs-json', (req: { headers: { authorization?: string } }, res: { setHeader: (k: string, v: string) => void; status: (n: number) => { end: () => void } }, next: () => void) => {
        const header = req.headers.authorization ?? '';
        const expected = `Basic ${Buffer.from(`${swaggerBasicUser}:${swaggerBasicPass}`).toString('base64')}`;
        if (header === expected) {
          next();
          return;
        }
        res.setHeader('WWW-Authenticate', 'Basic realm="Navomnis API docs"');
        res.status(401).end();
      });
    }
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Navomnis ERP API')
      .setDescription('API REST multi-tenant — documentação OpenAPI')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'X-Tenant-Id', in: 'header' }, 'tenant-header')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
