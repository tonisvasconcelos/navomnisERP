import type { INestApplication } from '@nestjs/common';
import { DocumentStatus, PartyKind, TenantStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createIntegrationApp } from './helpers/create-integration-app';

const run =
  process.env.CI === 'true' ||
  process.env.RUN_INTEGRATION === '1' ||
  process.env.RUN_INTEGRATION === 'true';

(run ? describe : describe.skip)('Tenant isolation (HTTP)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createIntegrationApp();
    prisma = app.get(PrismaService);
  }, 120_000);

  afterAll(async () => {
    await prisma.tenant.deleteMany({
      where: { slug: { in: ['integration-isolation', 'integration-leak', 'integration-leak-item'] } },
    });
    await prisma.user.deleteMany({ where: { email: 'iso-user@navomnis.test' } });
    await app.close();
  });

  it('isolates sales orders between tenants', async () => {
    const demoUser = await prisma.user.findFirstOrThrow({ where: { email: 'admin@demo.navomnis.local' } });

    const leakTenant = await prisma.tenant.create({
      data: {
        slug: 'integration-leak',
        name: 'Tenant Leak',
        status: TenantStatus.ACTIVE,
        branding: { create: {} },
      },
    });
    const leakCompany = await prisma.company.create({
      data: { tenantId: leakTenant.id, name: 'Filial Leak', isHead: true },
    });
    const leakCustomer = await prisma.party.create({
      data: {
        tenantId: leakTenant.id,
        kind: PartyKind.CUSTOMER,
        name: 'Cliente Leak',
        createdById: demoUser.id,
      },
    });
    await prisma.salesOrder.create({
      data: {
        tenantId: leakTenant.id,
        companyId: leakCompany.id,
        customerId: leakCustomer.id,
        number: 'ISO-LEAK-TEST',
        status: DocumentStatus.DRAFT,
        totalAmount: 0,
      },
    });

    try {
      const loginDemo = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@demo.navomnis.local',
          password: 'Admin123!',
          tenantSlug: 'demo',
        })
        .expect(200);

      const demoToken = loginDemo.body.data.accessToken as string;
      const demoOrders = await request(app.getHttpServer())
        .get('/api/v1/sales/orders')
        .set('Authorization', `Bearer ${demoToken}`)
        .expect(200);

      const demoList = demoOrders.body.data as { number: string }[];
      expect(demoList.some((o) => o.number === 'ISO-LEAK-TEST')).toBe(false);
    } finally {
      await prisma.tenant.delete({ where: { id: leakTenant.id } });
    }

    const isoTenant = await prisma.tenant.create({
      data: {
        slug: 'integration-isolation',
        name: 'Tenant Isolation',
        status: TenantStatus.ACTIVE,
        branding: { create: {} },
      },
    });
    const isoCompany = await prisma.company.create({
      data: { tenantId: isoTenant.id, name: 'Matriz ISO', isHead: true },
    });
    const passwordHash = await argon2.hash('IsoUser123!');
    const isoUser = await prisma.user.create({
      data: {
        email: 'iso-user@navomnis.test',
        passwordHash,
        displayName: 'ISO User',
      },
    });
    await prisma.userTenant.create({
      data: { userId: isoUser.id, tenantId: isoTenant.id, isDefault: true },
    });
    const isoRole = await prisma.role.create({
      data: { tenantId: isoTenant.id, name: 'Admin ISO', description: 'x' },
    });
    const perms = await prisma.permission.findMany({
      where: {
        code: {
          in: [
            'sales.read',
            'sales.write',
            'master.read',
            'master.write',
            'inventory.read',
            'audit.read',
          ],
        },
      },
    });
    for (const p of perms) {
      await prisma.rolePermission.create({
        data: { roleId: isoRole.id, permissionId: p.id },
      });
    }
    await prisma.userRole.create({ data: { userId: isoUser.id, roleId: isoRole.id } });

    const isoCustomer = await prisma.party.create({
      data: {
        tenantId: isoTenant.id,
        kind: PartyKind.CUSTOMER,
        name: 'Cliente ISO',
        createdById: isoUser.id,
      },
    });
    await prisma.salesOrder.create({
      data: {
        tenantId: isoTenant.id,
        companyId: isoCompany.id,
        customerId: isoCustomer.id,
        number: 'ISO-ONLY',
        status: DocumentStatus.DRAFT,
        totalAmount: 0,
      },
    });

    const loginIso = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'iso-user@navomnis.test',
        password: 'IsoUser123!',
        tenantSlug: 'integration-isolation',
      })
      .expect(200);

    const isoToken = loginIso.body.data.accessToken as string;
    const isoOrders = await request(app.getHttpServer())
      .get('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${isoToken}`)
      .expect(200);

    const isoList = isoOrders.body.data as { number: string }[];
    expect(isoList.some((o) => o.number === 'ISO-ONLY')).toBe(true);
    expect(isoList.some((o) => o.number === 'PV-0001')).toBe(false);
  });

  it('rejects sales line with item from another tenant', async () => {
    const leakTenant = await prisma.tenant.create({
      data: {
        slug: 'integration-leak-item',
        name: 'Tenant Leak Item',
        status: TenantStatus.ACTIVE,
        branding: { create: {} },
      },
    });
    const leakItem = await prisma.item.create({
      data: {
        tenantId: leakTenant.id,
        sku: 'LEAK-ITEM-ISO',
        name: 'Item outro tenant',
        baseUom: 'UN',
      },
    });
    try {
      const loginDemo = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@demo.navomnis.local',
          password: 'Admin123!',
          tenantSlug: 'demo',
        })
        .expect(200);

      const demoToken = loginDemo.body.data.accessToken as string;
      const orderRes = await request(app.getHttpServer())
        .post('/api/v1/sales/orders')
        .set('Authorization', `Bearer ${demoToken}`)
        .send({
          companyId: '00000000-0000-4000-8000-000000000020',
          customerId: '00000000-0000-4000-8000-000000000030',
        })
        .expect(200);

      const orderId = orderRes.body.data.id as string;

      await request(app.getHttpServer())
        .post(`/api/v1/sales/orders/${orderId}/lines`)
        .set('Authorization', `Bearer ${demoToken}`)
        .send({ itemId: leakItem.id, quantity: '1', unitPrice: '1' })
        .expect(400);
    } finally {
      await prisma.tenant.delete({ where: { id: leakTenant.id } });
    }
  });
});
