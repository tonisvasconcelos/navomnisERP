import type { INestApplication } from '@nestjs/common';
import { DocumentStatus, PartyKind, Prisma, TenantStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createIntegrationApp } from './helpers/create-integration-app';

const run =
  process.env.CI === 'true' ||
  process.env.RUN_INTEGRATION === '1' ||
  process.env.RUN_INTEGRATION === 'true';

const DEMO_COMPANY = '00000000-0000-4000-8000-000000000020';
const DEMO_CUSTOMER = '00000000-0000-4000-8000-000000000030';

(run ? describe : describe.skip)('V1 sales negatives + RBAC (HTTP)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let demoTenantId: string;
  let adminUserId: string;
  let extraCompanyId: string | null = null;

  beforeAll(async () => {
    app = await createIntegrationApp();
    prisma = app.get(PrismaService);
    const tenant = await prisma.tenant.findFirstOrThrow({ where: { slug: 'demo' } });
    demoTenantId = tenant.id;
    const admin = await prisma.user.findFirstOrThrow({ where: { email: 'admin@demo.navomnis.local' } });
    adminUserId = admin.id;
  }, 120_000);

  afterAll(async () => {
    if (extraCompanyId) {
      await prisma.company.deleteMany({ where: { id: extraCompanyId } });
    }
    await prisma.user.deleteMany({
      where: { email: { in: ['rbac-sales-read@integration.navomnis.test', 'rbac-no-audit@integration.navomnis.test'] } },
    });
    await app.close();
  });

  async function adminToken(): Promise<string> {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@demo.navomnis.local',
        password: 'Admin123!',
        tenantSlug: 'demo',
      })
      .expect(200);
    return login.body.data.accessToken as string;
  }

  it('rejects release when stock insufficient (400)', async () => {
    const token = await adminToken();
    const itemsRes = await request(app.getHttpServer())
      .get('/api/v1/inventory/items')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const items = itemsRes.body.data as { id: string; sku: string }[];
    const item = items.find((i) => i.sku === 'ITEM-001');
    expect(item).toBeDefined();

    const orderRes = await request(app.getHttpServer())
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ companyId: DEMO_COMPANY, customerId: DEMO_CUSTOMER })
      .expect(200);
    const orderId = orderRes.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/sales/orders/${orderId}/lines`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: item!.id, quantity: '999999', unitPrice: '1' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/sales/orders/${orderId}/release`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('rejects double release (400)', async () => {
    const token = await adminToken();
    const itemsRes = await request(app.getHttpServer())
      .get('/api/v1/inventory/items')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const items = itemsRes.body.data as { id: string; sku: string }[];
    const item = items.find((i) => i.sku === 'ITEM-001');
    expect(item).toBeDefined();

    const orderRes = await request(app.getHttpServer())
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ companyId: DEMO_COMPANY, customerId: DEMO_CUSTOMER })
      .expect(200);
    const orderId = orderRes.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/sales/orders/${orderId}/lines`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: item!.id, quantity: '1', unitPrice: '10' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/sales/orders/${orderId}/release`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/sales/orders/${orderId}/release`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('rejects remove line when order not draft (404)', async () => {
    const token = await adminToken();
    const itemsRes = await request(app.getHttpServer())
      .get('/api/v1/inventory/items')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const items = itemsRes.body.data as { id: string; sku: string }[];
    const item = items.find((i) => i.sku === 'ITEM-001');
    expect(item).toBeDefined();

    const orderRes = await request(app.getHttpServer())
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ companyId: DEMO_COMPANY, customerId: DEMO_CUSTOMER })
      .expect(200);
    const orderId = orderRes.body.data.id as string;

    const lineRes = await request(app.getHttpServer())
      .post(`/api/v1/sales/orders/${orderId}/lines`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: item!.id, quantity: '1', unitPrice: '10' })
      .expect(200);
    const lineId = (lineRes.body.data.lines as { id: string }[]).find(() => true)?.id;
    expect(lineId).toBeDefined();

    await request(app.getHttpServer())
      .post(`/api/v1/sales/orders/${orderId}/release`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/sales/orders/${orderId}/lines/${lineId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('denies create order without sales.write (403)', async () => {
    const passwordHash = await argon2.hash('RbacRead123!');
    const user = await prisma.user.create({
      data: {
        email: 'rbac-sales-read@integration.navomnis.test',
        passwordHash,
        displayName: 'RBAC read',
      },
    });
    await prisma.userTenant.create({
      data: { userId: user.id, tenantId: demoTenantId, isDefault: true },
    });
    const role = await prisma.role.create({
      data: { tenantId: demoTenantId, name: 'Sales read only (test)', description: 'integration' },
    });
    const codes = ['sales.read', 'inventory.read', 'core.tenant.read'];
    const perms = await prisma.permission.findMany({ where: { code: { in: codes } } });
    for (const p of perms) {
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } });
    }
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'rbac-sales-read@integration.navomnis.test',
        password: 'RbacRead123!',
        tenantSlug: 'demo',
      })
      .expect(200);
    const token = login.body.data.accessToken as string;

    await request(app.getHttpServer())
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ companyId: DEMO_COMPANY, customerId: DEMO_CUSTOMER })
      .expect(403);

    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.role.delete({ where: { id: role.id } });
    await prisma.userTenant.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('denies audit logs without audit.read (403)', async () => {
    const passwordHash = await argon2.hash('RbacNoAudit123!');
    const user = await prisma.user.create({
      data: {
        email: 'rbac-no-audit@integration.navomnis.test',
        passwordHash,
        displayName: 'RBAC no audit',
      },
    });
    await prisma.userTenant.create({
      data: { userId: user.id, tenantId: demoTenantId, isDefault: true },
    });
    const role = await prisma.role.create({
      data: { tenantId: demoTenantId, name: 'No audit (test)', description: 'integration' },
    });
    const all = await prisma.permission.findMany({ where: { code: { not: 'audit.read' } } });
    for (const p of all) {
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } });
    }
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    await prisma.userCompany.upsert({
      where: { userId_companyId: { userId: user.id, companyId: DEMO_COMPANY } },
      update: {},
      create: { userId: user.id, companyId: DEMO_COMPANY },
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'rbac-no-audit@integration.navomnis.test',
        password: 'RbacNoAudit123!',
        tenantSlug: 'demo',
      })
      .expect(200);
    const token = login.body.data.accessToken as string;

    await request(app.getHttpServer())
      .get('/api/v1/audit/logs')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.role.delete({ where: { id: role.id } });
    await prisma.userCompany.deleteMany({ where: { userId: user.id } });
    await prisma.userTenant.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it('returns 404 when PATCH line id belongs to another tenant', async () => {
    const t = await prisma.tenant.create({
      data: {
        slug: 'integration-xfer-line',
        name: 'Xfer line tenant',
        status: TenantStatus.ACTIVE,
        branding: { create: {} },
      },
    });
    try {
      const co = await prisma.company.create({
        data: { tenantId: t.id, name: 'Xfer co', isHead: true },
      });
      const party = await prisma.party.create({
        data: {
          tenantId: t.id,
          kind: PartyKind.CUSTOMER,
          name: 'Xfer customer',
          createdById: adminUserId,
        },
      });
      const item = await prisma.item.create({
        data: {
          tenantId: t.id,
          sku: 'XFER-SKU-1',
          name: 'Xfer item',
          baseUom: 'UN',
        },
      });
      const so = await prisma.salesOrder.create({
        data: {
          tenantId: t.id,
          companyId: co.id,
          customerId: party.id,
          number: 'XFER-ORD-1',
          status: DocumentStatus.DRAFT,
          totalAmount: new Prisma.Decimal(10),
          lines: {
            create: {
              itemId: item.id,
              quantity: 1,
              unitPrice: 10,
              lineTotal: 10,
            },
          },
        },
        include: { lines: true },
      });
      const foreignLineId = so.lines[0].id;

      const token = await adminToken();
      const itemsRes = await request(app.getHttpServer())
        .get('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const items = itemsRes.body.data as { id: string; sku: string }[];
      const demoItem = items.find((i) => i.sku === 'ITEM-001');
      expect(demoItem).toBeDefined();

      const orderRes = await request(app.getHttpServer())
        .post('/api/v1/sales/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ companyId: DEMO_COMPANY, customerId: DEMO_CUSTOMER })
        .expect(200);
      const demoOrderId = orderRes.body.data.id as string;
      await request(app.getHttpServer())
        .post(`/api/v1/sales/orders/${demoOrderId}/lines`)
        .set('Authorization', `Bearer ${token}`)
        .send({ itemId: demoItem!.id, quantity: '1', unitPrice: '10' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/v1/sales/orders/${demoOrderId}/lines/${foreignLineId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: '2', unitPrice: '20' })
        .expect(404);
    } finally {
      await prisma.tenant.deleteMany({ where: { id: t.id } });
    }
  });

  it('returns 404 when DELETE line id belongs to another tenant', async () => {
    const t = await prisma.tenant.create({
      data: {
        slug: 'integration-xfer-line-del',
        name: 'Xfer del tenant',
        status: TenantStatus.ACTIVE,
        branding: { create: {} },
      },
    });
    try {
      const co = await prisma.company.create({
        data: { tenantId: t.id, name: 'Xfer co del', isHead: true },
      });
      const party = await prisma.party.create({
        data: {
          tenantId: t.id,
          kind: PartyKind.CUSTOMER,
          name: 'Xfer customer del',
          createdById: adminUserId,
        },
      });
      const item = await prisma.item.create({
        data: {
          tenantId: t.id,
          sku: 'XFER-SKU-2',
          name: 'Xfer item del',
          baseUom: 'UN',
        },
      });
      const so = await prisma.salesOrder.create({
        data: {
          tenantId: t.id,
          companyId: co.id,
          customerId: party.id,
          number: 'XFER-ORD-2',
          status: DocumentStatus.DRAFT,
          totalAmount: new Prisma.Decimal(10),
          lines: {
            create: {
              itemId: item.id,
              quantity: 1,
              unitPrice: 10,
              lineTotal: 10,
            },
          },
        },
        include: { lines: true },
      });
      const foreignLineId = so.lines[0].id;

      const token = await adminToken();
      const itemsRes = await request(app.getHttpServer())
        .get('/api/v1/inventory/items')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const items = itemsRes.body.data as { id: string; sku: string }[];
      const demoItem = items.find((i) => i.sku === 'ITEM-001');
      expect(demoItem).toBeDefined();

      const orderRes = await request(app.getHttpServer())
        .post('/api/v1/sales/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ companyId: DEMO_COMPANY, customerId: DEMO_CUSTOMER })
        .expect(200);
      const demoOrderId = orderRes.body.data.id as string;
      await request(app.getHttpServer())
        .post(`/api/v1/sales/orders/${demoOrderId}/lines`)
        .set('Authorization', `Bearer ${token}`)
        .send({ itemId: demoItem!.id, quantity: '1', unitPrice: '10' })
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/api/v1/sales/orders/${demoOrderId}/lines/${foreignLineId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    } finally {
      await prisma.tenant.deleteMany({ where: { id: t.id } });
    }
  });

  it('returns 404 when PATCH line on non-draft order', async () => {
    const token = await adminToken();
    const itemsRes = await request(app.getHttpServer())
      .get('/api/v1/inventory/items')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const items = itemsRes.body.data as { id: string; sku: string }[];
    const item = items.find((i) => i.sku === 'ITEM-001');
    expect(item).toBeDefined();

    const orderRes = await request(app.getHttpServer())
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ companyId: DEMO_COMPANY, customerId: DEMO_CUSTOMER })
      .expect(200);
    const orderId = orderRes.body.data.id as string;

    const lineRes = await request(app.getHttpServer())
      .post(`/api/v1/sales/orders/${orderId}/lines`)
      .set('Authorization', `Bearer ${token}`)
      .send({ itemId: item!.id, quantity: '1', unitPrice: '10' })
      .expect(200);
    const lineId = (lineRes.body.data.lines as { id: string }[])[0]!.id;

    await request(app.getHttpServer())
      .post(`/api/v1/sales/orders/${orderId}/release`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/sales/orders/${orderId}/lines/${lineId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: '2', unitPrice: '10' })
      .expect(404);
  });

  it('denies create order for company not linked to user (403)', async () => {
    const co = await prisma.company.create({
      data: { tenantId: demoTenantId, name: 'Filial sem UserCompany', isHead: false },
    });
    extraCompanyId = co.id;

    const token = await adminToken();

    await request(app.getHttpServer())
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ companyId: co.id, customerId: DEMO_CUSTOMER })
      .expect(403);
  });

  it('logs failed password attempt to AccessLog', async () => {
    const before = await prisma.accessLog.count({
      where: { userId: adminUserId, success: false, reason: 'invalid_password' },
    });
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@demo.navomnis.local',
        password: 'WrongPassword!!!',
        tenantSlug: 'demo',
      })
      .expect(401);
    const after = await prisma.accessLog.count({
      where: { userId: adminUserId, success: false, reason: 'invalid_password' },
    });
    expect(after).toBeGreaterThan(before);
  });
});
