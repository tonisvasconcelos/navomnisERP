import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { configuration } from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { TenantModule } from './tenant/tenant.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RbacModule } from './rbac/rbac.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthModule } from './modules/health/health.module';
import { FinanceModule } from './modules/finance/finance.module';
import { SalesModule } from './modules/sales/sales.module';
import { PartiesModule } from './modules/parties/parties.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { LgpdModule } from './modules/lgpd/lgpd.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { BullQueuesModule } from './queues/bull-queues.module';
import { FiscalModule } from './modules/fiscal/fiscal.module';
import { PostingModule } from './modules/posting/posting.module';
import { ProduceModule } from './modules/produce/produce.module';
import { BankingModule } from './modules/banking/banking.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        autoLogging: {
          ignore: (req) => (req.url ?? '').startsWith('/api/v1/health'),
        },
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.accessToken',
          'req.body.refreshToken',
        ],
      },
    }),
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
      },
    }),
    BullQueuesModule,
    PrismaModule,
    AuditModule,
    TenantModule,
    AuthModule,
    RbacModule,
    HealthModule,
    FinanceModule,
    PartiesModule,
    SalesModule,
    PurchasesModule,
    InventoryModule,
    FiscalModule,
    PostingModule,
    ProduceModule,
    LgpdModule,
    NotificationsModule.forApi(),
    BankingModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
