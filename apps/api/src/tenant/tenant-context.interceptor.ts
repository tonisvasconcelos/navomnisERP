import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tenantStorage } from './tenant-storage';

type JwtUser = { sub: string; tid?: string };

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    const user = req.user;
    if (user?.tid && user.sub) {
      tenantStorage.enterWith({ tenantId: user.tid, userId: user.sub });
    }
    return next.handle();
  }
}
