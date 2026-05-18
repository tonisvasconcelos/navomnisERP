import { randomUUID } from 'node:crypto';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { runWithPlatformContext } from '../platform-storage';
import type { PlatformJwtPayload } from '../auth/platform-jwt.types';

@Injectable()
export class PlatformContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ user?: PlatformJwtPayload }>();
    const operatorId = req.user?.sub;
    if (!operatorId) {
      return next.handle();
    }
    const requestId = randomUUID();
    return new Observable((subscriber) => {
      runWithPlatformContext({ operatorId, requestId }, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
