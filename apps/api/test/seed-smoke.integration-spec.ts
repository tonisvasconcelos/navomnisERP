import type { INestApplication } from '@nestjs/common';
import { createIntegrationApp } from './helpers/create-integration-app';
import { PrismaService } from '../src/prisma/prisma.service';

const run =
  process.env.CI === 'true' ||
  process.env.RUN_INTEGRATION === '1' ||
  process.env.RUN_INTEGRATION === 'true';

(run ? describe : describe.skip)('Seed smoke (database fixtures)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createIntegrationApp();
    prisma = app.get(PrismaService);
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  it('demo tenant, admin, company, item, and sales order series exist after seed', async () => {
    const tenant = await prisma.tenant.findFirstOrThrow({ where: { slug: 'demo' } });
    expect(tenant.status).toBeDefined();

    const admin = await prisma.user.findFirstOrThrow({
      where: { email: 'admin@demo.navomnis.local' },
    });
    expect(admin.passwordHash).toBeTruthy();

    const link = await prisma.userTenant.findFirst({
      where: { userId: admin.id, tenantId: tenant.id },
    });
    expect(link).toBeTruthy();

    const company = await prisma.company.findFirst({
      where: { id: '00000000-0000-4000-8000-000000000020', tenantId: tenant.id },
    });
    expect(company).toBeTruthy();

    const uc = await prisma.userCompany.findFirst({
      where: { userId: admin.id, companyId: company!.id },
    });
    expect(uc).toBeTruthy();

    const item = await prisma.item.findFirst({
      where: { tenantId: tenant.id, sku: 'ITEM-001' },
    });
    expect(item).toBeTruthy();

    const series = await prisma.documentNumberSeries.findFirst({
      where: { tenantId: tenant.id, code: 'SALES_ORDER' },
    });
    expect(series).toBeTruthy();

    const salesWrite = await prisma.permission.findFirst({ where: { code: 'sales.write' } });
    const auditRead = await prisma.permission.findFirst({ where: { code: 'audit.read' } });
    expect(salesWrite).toBeTruthy();
    expect(auditRead).toBeTruthy();
  });
});
