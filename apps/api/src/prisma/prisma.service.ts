import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { getTenantContext } from '../tenant/tenant-storage';

const TENANT_MODELS = new Set<string>([
  'TenantBranding',
  'UserTenant',
  'Company',
  'Party',
  'Item',
  'Role',
  'Notification',
  'AuditLog',
  'SalesOrder',
  'PurchaseOrder',
  'ItemLedgerEntry',
  'ChartOfAccount',
  'GlEntry',
  'ApprovalWorkflow',
  'Opportunity',
  'OutboxEvent',
  'Attachment',
  'NotificationPreference',
  'FiscalJurisdiction',
  'FiscalRegimeSetup',
  'TaxArea',
  'TaxGroup',
  'FiscalOperationType',
  'TaxDeterminationRule',
  'ProductFiscalProfile',
  'PartyFiscalProfile',
  'ItemFiscalTemplate',
  'ServiceFiscalTemplate',
  'CompanyFiscalProfile',
  'Branch',
  'BranchFiscalProfile',
  'Employee',
  'EmployeeTaxProfile',
  'AgriculturalItemProfile',
  'PackagingType',
  'Warehouse',
  'WarehouseZone',
  'InventoryLot',
  'QualityInspection',
  'InventoryLossEvent',
  'InventoryValueEntry',
  'LandedCostAllocation',
  'DeliveryRoute',
  'FiscalDocument',
  'FiscalDocumentLine',
  'FiscalDocumentLineTax',
  'PostingJournal',
  'PostingJournalLine',
  'PostingSetup',
  'TaxPostingSetup',
  'FiscalPostingSetup',
  'CustomerLedgerEntry',
  'SupplierLedgerEntry',
  'BankLedgerEntry',
  'TaxLedgerEntry',
  'TaxSettlementLedgerEntry',
]);

function mergeTenantWhere<T extends object>(
  args: T,
  tenantId: string,
): T {
  const a = args as { where?: object };
  if (!a.where) {
    return { ...args, where: { tenantId } } as T;
  }
  return { ...args, where: { AND: [a.where, { tenantId }] } } as T;
}

function injectTenantData(data: unknown, tenantId: string): unknown {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) {
    return data.map((row) =>
      typeof row === 'object' && row !== null
        ? { ...(row as object), tenantId }
        : row,
    );
  }
  if (typeof data === 'object') {
    return { ...(data as object), tenantId };
  }
  return data;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
    this.$use(async (params: Prisma.MiddlewareParams, next) => {
      const model = params.model;
      if (!model || !TENANT_MODELS.has(model)) {
        return next(params);
      }
      const ctx = getTenantContext();
      if (!ctx) {
        return next(params);
      }
      const { tenantId } = ctx;

      switch (params.action) {
        case 'findUnique':
        case 'findFirst':
        case 'findMany':
        case 'count':
        case 'aggregate':
        case 'groupBy': {
          params.args = mergeTenantWhere(params.args ?? {}, tenantId);
          break;
        }
        case 'update':
        case 'delete':
        case 'upsert': {
          // update/delete/upsert require WhereUniqueInput — AND tenant filters are invalid.
          // Models use globally unique ids; tenant isolation is enforced in services.
          break;
        }
        case 'updateMany':
        case 'deleteMany': {
          params.args = mergeTenantWhere(params.args ?? {}, tenantId);
          break;
        }
        case 'create': {
          params.args = {
            ...params.args,
            data: injectTenantData((params.args as { data?: unknown }).data, tenantId),
          };
          break;
        }
        case 'createMany': {
          const args = params.args as { data?: unknown };
          params.args = {
            ...params.args,
            data: injectTenantData(args.data, tenantId),
          };
          break;
        }
        default:
          break;
      }

      return next(params);
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
