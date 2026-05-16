import type { INestApplication } from '@nestjs/common';
import { TenantStatus } from '@prisma/client';
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

(run ? describe : describe.skip)('GET /audit/logs filters (HTTP)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;

  beforeAll(async () => {
    app = await createIntegrationApp();
    prisma = app.get(PrismaService);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@demo.navomnis.local',
        password: 'Admin123!',
        tenantSlug: 'demo',
      })
      .expect(200);
    accessToken = login.body.data.accessToken as string;

    const itemsRes = await request(app.getHttpServer())
      .get('/api/v1/inventory/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const items = itemsRes.body.data as { id: string; sku: string }[];
    const item = items.find((i) => i.sku === 'ITEM-001');
    const orderRes = await request(app.getHttpServer())
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ companyId: DEMO_COMPANY, customerId: DEMO_CUSTOMER })
      .expect(200);
    const orderId = orderRes.body.data.id as string;
    await request(app.getHttpServer())
      .post(`/api/v1/sales/orders/${orderId}/lines`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ itemId: item!.id, quantity: '1', unitPrice: '1' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/sales/orders/${orderId}/release`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  }, 120_000);

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { action: 'audit_iso_marker' } });
    await prisma.tenant.deleteMany({ where: { slug: 'audit-iso-tenant' } });
    await prisma.user.deleteMany({ where: { email: 'audit-iso-only@integration.test' } });
    await app.close();
  });

  it('clamps take between 1 and 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/audit/logs')
      .query({ take: 9999 })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const rows = res.body.data as unknown[];
    expect(rows.length).toBeLessThanOrEqual(200);
  });

  it('filters by action substring', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/audit/logs')
      .query({ take: 50, action: 'sales_order' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const rows = res.body.data as { action: string }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.action.toLowerCase().includes('sales_order'))).toBe(true);
  });

  it('filters by entityType case-insensitively', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/audit/logs')
      .query({ take: 50, entityType: 'salesorder' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const rows = res.body.data as { entityType: string }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.entityType.toLowerCase() === 'salesorder')).toBe(true);
  });

  it('filters by createdAt range', async () => {
    const from = new Date(Date.now() - 60_000).toISOString();
    const to = new Date(Date.now() + 60_000).toISOString();
    const res = await request(app.getHttpServer())
      .get('/api/v1/audit/logs')
      .query({ take: 50, from, to })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const rows = res.body.data as { createdAt: string }[];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const t = new Date(row.createdAt).getTime();
      expect(t).toBeGreaterThanOrEqual(new Date(from).getTime());
      expect(t).toBeLessThanOrEqual(new Date(to).getTime());
    }
  });

  it('does not return audit rows from another tenant', async () => {
    const demoTenant = await prisma.tenant.findFirstOrThrow({ where: { slug: 'demo' } });
    const otherTenant = await prisma.tenant.create({
      data: {
        slug: 'audit-iso-tenant',
        name: 'Audit ISO',
        status: TenantStatus.ACTIVE,
        branding: { create: {} },
      },
    });
    const isoUser = await prisma.user.create({
      data: {
        email: 'audit-iso-only@integration.test',
        passwordHash: await argon2.hash('AuditIso123!'),
        displayName: 'Audit ISO',
      },
    });
    await prisma.auditLog.create({
      data: {
        tenantId: otherTenant.id,
        actorId: isoUser.id,
        action: 'audit_iso_marker',
        entityType: 'SalesOrder',
        entityId: '00000000-0000-4000-8000-000000009999',
      },
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/audit/logs')
      .query({ take: 200, action: 'audit_iso_marker' })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const rows = res.body.data as { action: string; tenantId?: string }[];
    expect(rows.some((r) => r.action === 'audit_iso_marker')).toBe(false);

    const demoLogs = await prisma.auditLog.findMany({
      where: { tenantId: demoTenant.id, action: 'audit_iso_marker' },
    });
    expect(demoLogs).toHaveLength(0);
  });

  it('returns 403 without audit.read permission', async () => {
    const demoTenant = await prisma.tenant.findFirstOrThrow({ where: { slug: 'demo' } });
    const passwordHash = await argon2.hash('NoAuditRead123!');
    const user = await prisma.user.create({
      data: {
        email: 'no-audit-read-filters@integration.test',
        passwordHash,
        displayName: 'No audit read',
      },
    });
    await prisma.userTenant.create({
      data: { userId: user.id, tenantId: demoTenant.id, isDefault: true },
    });
    const role = await prisma.role.create({
      data: { tenantId: demoTenant.id, name: 'No audit filters test', description: 'integration' },
    });
    const perms = await prisma.permission.findMany({ where: { code: { not: 'audit.read' } } });
    for (const p of perms) {
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } });
    }
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'no-audit-read-filters@integration.test',
        password: 'NoAuditRead123!',
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
    await prisma.userTenant.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});
