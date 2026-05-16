import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantContext } from '../../tenant/tenant-storage';
import { AuditService } from './audit.service';

jest.mock('../../tenant/tenant-storage', () => ({
  getTenantContext: jest.fn(),
}));

const mockGetTenantContext = getTenantContext as jest.MockedFunction<typeof getTenantContext>;

describe('AuditService', () => {
  let service: AuditService;
  const prisma = {
    auditLog: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGetTenantContext.mockReturnValue({ tenantId: 'tenant-a', userId: 'user-1' });
    const moduleRef = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(AuditService);
  });

  it('scopes listRecent to current tenant', async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);
    await service.listRecent(10);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-a' }),
      }),
    );
  });

  it('applies action and entityType filters', async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);
    await service.listRecent(50, { action: 'sales', entityType: 'SalesOrder' });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          action: { contains: 'sales', mode: 'insensitive' },
          entityType: { equals: 'SalesOrder', mode: 'insensitive' },
        }),
      }),
    );
  });

  it('rejects invalid from date', () => {
    expect(() => service.listRecent(10, { from: 'not-a-date' })).toThrow(BadRequestException);
  });

  it('throws when tenant context is missing', () => {
    mockGetTenantContext.mockReturnValue(undefined);
    expect(() => service.listRecent(10)).toThrow(ForbiddenException);
  });
});
