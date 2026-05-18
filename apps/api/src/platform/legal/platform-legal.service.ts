import { Injectable, NotFoundException } from '@nestjs/common';
import { ConsentKind, LegalDocumentStatus } from '@prisma/client';
import { PlatformPrismaService } from '../../prisma/platform-prisma.service';

@Injectable()
export class PlatformLegalService {
  constructor(private readonly prisma: PlatformPrismaService) {}

  list(kind?: ConsentKind) {
    return this.prisma.legalDocumentVersion.findMany({
      where: kind ? { kind } : {},
      orderBy: [{ kind: 'asc' }, { effectiveAt: 'desc' }],
    });
  }

  createDraft(data: {
    kind: ConsentKind;
    version: string;
    content: string;
    isMandatory?: boolean;
    effectiveAt?: string;
  }) {
    return this.prisma.legalDocumentVersion.create({
      data: {
        kind: data.kind,
        version: data.version,
        content: data.content,
        isMandatory: data.isMandatory ?? true,
        status: LegalDocumentStatus.DRAFT,
        effectiveAt: data.effectiveAt ? new Date(data.effectiveAt) : new Date(),
      },
    });
  }

  async publish(id: string, operatorId: string) {
    const doc = await this.prisma.legalDocumentVersion.findUnique({ where: { id } });
    if (!doc) {
      throw new NotFoundException('Documento não encontrado.');
    }
    return this.prisma.legalDocumentVersion.update({
      where: { id },
      data: {
        status: LegalDocumentStatus.PUBLISHED,
        publishedAt: new Date(),
        publishedByPlatformId: operatorId,
      },
    });
  }
}
