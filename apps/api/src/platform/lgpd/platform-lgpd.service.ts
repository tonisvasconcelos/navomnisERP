import { Injectable } from '@nestjs/common';
import { DataSubjectRequestStatus, DataSubjectRequestType } from '@prisma/client';
import { PlatformPrismaService } from '../../prisma/platform-prisma.service';

@Injectable()
export class PlatformLgpdService {
  constructor(private readonly prisma: PlatformPrismaService) {}

  consentOverview() {
    return this.prisma.consentRecord.groupBy({
      by: ['kind', 'version'],
      _count: { id: true },
      orderBy: { kind: 'asc' },
    });
  }

  listRequests(status?: DataSubjectRequestStatus) {
    return this.prisma.dataSubjectRequest.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  createRequest(data: {
    tenantId: string;
    userId?: string;
    email?: string;
    requestType: DataSubjectRequestType;
    notes?: string;
  }) {
    return this.prisma.dataSubjectRequest.create({ data });
  }

  updateRequestStatus(id: string, status: DataSubjectRequestStatus) {
    return this.prisma.dataSubjectRequest.update({
      where: { id },
      data: {
        status,
        completedAt: status === DataSubjectRequestStatus.COMPLETED ? new Date() : undefined,
      },
    });
  }

  retentionPolicies() {
    return this.prisma.dataRetentionPolicy.findMany({ orderBy: { category: 'asc' } });
  }
}
