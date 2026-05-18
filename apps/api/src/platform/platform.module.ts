import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PlatformPrismaService } from '../prisma/platform-prisma.service';
import { PlatformAuthController } from './auth/platform-auth.controller';
import { PlatformAuthService } from './auth/platform-auth.service';
import { PlatformJwtStrategy } from './auth/strategies/platform-jwt.strategy';
import { PlatformJwtGuard } from './auth/guards/platform-jwt.guard';
import { PlatformPermissionsGuard } from './rbac/platform-permissions.guard';
import { PlatformTenantsController } from './tenants/platform-tenants.controller';
import { PlatformTenantsService } from './tenants/platform-tenants.service';
import { PlatformUsersController } from './users/platform-users.controller';
import { PlatformUsersService } from './users/platform-users.service';
import { PlatformSubscriptionsController } from './subscriptions/platform-subscriptions.controller';
import { PlatformSubscriptionsService } from './subscriptions/platform-subscriptions.service';
import { PlatformTelemetryController } from './telemetry/platform-telemetry.controller';
import { PlatformTelemetryService } from './telemetry/platform-telemetry.service';
import { PlatformObservabilityController } from './observability/platform-observability.controller';
import { PlatformLegalController } from './legal/platform-legal.controller';
import { PlatformLegalService } from './legal/platform-legal.service';
import { PlatformLgpdController } from './lgpd/platform-lgpd.controller';
import { PlatformLgpdService } from './lgpd/platform-lgpd.service';
import { PlatformFeatureFlagsController } from './feature-flags/platform-feature-flags.controller';
import { PlatformAuditController } from './audit/platform-audit.controller';
import { PlatformImpersonationController } from './impersonation/platform-impersonation.controller';
import { NotificationsModule } from '../modules/notifications/notifications.module';

@Module({
  imports: [
    NotificationsModule.forApi(),
    PassportModule.register({ defaultStrategy: 'platform-jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('platformJwtAccessSecret'),
        signOptions: {
          expiresIn: config.get<string>('platformJwtAccessExpires') ?? '15m',
        },
      }),
    }),
  ],
  controllers: [
    PlatformAuthController,
    PlatformTenantsController,
    PlatformUsersController,
    PlatformSubscriptionsController,
    PlatformTelemetryController,
    PlatformObservabilityController,
    PlatformLegalController,
    PlatformLgpdController,
    PlatformFeatureFlagsController,
    PlatformAuditController,
    PlatformImpersonationController,
  ],
  providers: [
    PlatformPrismaService,
    PlatformAuthService,
    PlatformJwtStrategy,
    PlatformJwtGuard,
    PlatformPermissionsGuard,
    PlatformTenantsService,
    PlatformUsersService,
    PlatformSubscriptionsService,
    PlatformTelemetryService,
    PlatformLegalService,
    PlatformLgpdService,
  ],
  exports: [PlatformPrismaService, PlatformJwtGuard, PlatformPermissionsGuard],
})
export class PlatformModule {}
