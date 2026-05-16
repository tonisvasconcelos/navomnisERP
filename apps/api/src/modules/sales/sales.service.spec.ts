import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DocumentStatus } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantContext } from '../../tenant/tenant-storage';
import { AuditService } from '../audit/audit.service';
import { SalesService } from './sales.service';

jest.mock('../../tenant/tenant-storage', () => ({
  getTenantContext: jest.fn(),
}));

const mockGetTenantContext = getTenantContext as jest.MockedFunction<typeof getTenantContext>;

describe('SalesService', () => {
  let service: SalesService;
  const prisma = {
    salesOrder: { findFirst: jest.fn(), findMany: jest.fn() },
    userCompany: { findFirst: jest.fn() },
    party: { findFirst: jest.fn() },
    company: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const audit = { logMutation: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGetTenantContext.mockReturnValue({ tenantId: 'tenant-1', userId: 'user-1' });
    const moduleRef = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = moduleRef.get(SalesService);
  });

  describe('getOrder', () => {
    it('throws NotFound when order is outside tenant', async () => {
      prisma.salesOrder.findFirst.mockResolvedValue(null);
      await expect(service.getOrder('missing-id')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.salesOrder.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'missing-id', tenantId: 'tenant-1' } }),
      );
    });
  });

  describe('createOrder', () => {
    it('throws Forbidden when user has no UserCompany for company', async () => {
      prisma.party.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.company.findFirst.mockResolvedValue({ id: 'co-1' });
      prisma.userCompany.findFirst.mockResolvedValue(null);

      await expect(
        service.createOrder({ companyId: 'co-1', customerId: 'cust-1' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('releaseOrder', () => {
    it('rejects non-draft orders', async () => {
      prisma.$transaction.mockImplementation(async (cb: (tx: { salesOrder: { findFirst: jest.Mock } }) => unknown) =>
        cb({
          salesOrder: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'ord-1',
              tenantId: 'tenant-1',
              companyId: 'co-1',
              status: DocumentStatus.OPEN,
              lines: [{ itemId: 'item-1', quantity: 1 }],
            }),
          },
        }),
      );

      await expect(service.releaseOrder('ord-1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
