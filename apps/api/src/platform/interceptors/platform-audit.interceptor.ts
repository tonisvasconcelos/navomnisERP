import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditScope } from '@prisma/client';
import { PlatformPrismaService } from '../../prisma/platform-prisma.service';
import { getPlatformContext } from '../platform-storage';
import type { PlatformJwtPayload } from '../auth/platform-jwt.types';

@Injectable()
export class PlatformAuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PlatformPrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<{
        user?: PlatformJwtPayload;
        method: string;
        route?: { path: string };
        ip?: string;
        headers: Record<string, string | string[] | undefined>;
        params?: { id?: string; tenantId?: string };
        body?: { tenantId?: string };
      }>();
    const handler = context.getHandler().name;
    const path = req.route?.path ?? '';
    const targetTenantId = req.params?.tenantId ?? req.params?.id ?? req.body?.tenantId;

    return next.handle().pipe(
      tap(async () => {
        const ctx = getPlatformContext();
        if (!ctx?.operatorId) {
          return;
        }
        await this.prisma.auditLog.create({
          data: {
            scope: AuditScope.PLATFORM,
            platformOperatorId: ctx.operatorId,
            targetTenantId: typeof targetTenantId === 'string' ? targetTenantId : undefined,
            action: `${req.method} ${path}.${handler}`,
            entityType: 'platform_route',
            requestId: ctx.requestId,
            ip: req.ip,
            userAgent: String(req.headers['user-agent'] ?? ''),
          },
        });
      }),
    );
  }
}
