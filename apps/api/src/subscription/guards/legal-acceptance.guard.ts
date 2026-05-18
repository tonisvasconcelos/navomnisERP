import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { LegalDocumentStatus } from '@prisma/client';
import { PlatformPrismaService } from '../../prisma/platform-prisma.service';

@Injectable()
export class LegalAcceptanceGuard implements CanActivate {
  constructor(private readonly prisma: PlatformPrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: { sub?: string; tid?: string }; path?: string }>();
    if (req.path?.includes('/platform/') || req.path?.includes('/auth/') || req.path?.includes('/health')) {
      return true;
    }
    const userId = req.user?.sub;
    const tenantId = req.user?.tid;
    if (!userId) {
      return true;
    }
    const mandatory = await this.prisma.legalDocumentVersion.findMany({
      where: { isMandatory: true, status: LegalDocumentStatus.PUBLISHED },
    });
    if (!mandatory.length) {
      return true;
    }
    for (const doc of mandatory) {
      const accepted = await this.prisma.consentRecord.findFirst({
        where: {
          userId,
          kind: doc.kind,
          OR: [
            { legalDocumentVersionId: doc.id },
            { version: doc.version },
          ],
          ...(tenantId ? { tenantId } : {}),
        },
      });
      if (!accepted) {
        throw new ForbiddenException({
          code: 'LEGAL_ACCEPTANCE_REQUIRED',
          kind: doc.kind,
          version: doc.version,
        });
      }
    }
    return true;
  }
}
