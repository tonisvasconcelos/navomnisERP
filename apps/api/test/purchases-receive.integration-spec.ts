import type { INestApplication } from '@nestjs/common';
import * as argon2 from 'argon2';
import request from 'supertest';
import { DocumentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createIntegrationApp } from './helpers/create-integration-app';

const run =
  process.env.CI === 'true' ||
  process.env.RUN_INTEGRATION === '1' ||
  process.env.RUN_INTEGRATION === 'true';

(run ? describe : describe.skip)('Purchase order receive (HTTP)', () => {
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
      });
    accessToken = login.body.data.accessToken as string;
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  it('receives OPEN PO and posts positive ledger', async () => {
    const po = await prisma.purchaseOrder.findFirst({
      where: { number: 'PC-0001' },
      include: { lines: true },
    });
    expect(po).toBeTruthy();
    const lineId = po!.lines[0]!.id;

    await prisma.itemLedgerEntry.deleteMany({
      where: {
        tenantId: po!.tenantId,
        documentType: 'PURCHASE_ORDER_LINE',
        documentId: lineId,
      },
    });
    await prisma.purchaseOrder.update({
      where: { id: po!.id },
      data: { status: DocumentStatus.OPEN },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/purchases/orders/${po!.id}/receive`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ lines: [{ lineId, quantity: '1' }] })
      .expect(200);

    expect(res.body.data.status).toBe(DocumentStatus.POSTED);

    const ledger = await prisma.itemLedgerEntry.findMany({
      where: {
        tenantId: po!.tenantId,
        documentType: 'PURCHASE_ORDER_LINE',
        documentId: lineId,
        entryType: 'PURCHASE_RECEIVE',
      },
    });
    expect(ledger.length).toBe(1);
    expect(new Prisma.Decimal(ledger[0]!.quantity).toNumber()).toBe(1);
  });

  it('rejects duplicate receive over ordered quantity', async () => {
    const po = await prisma.purchaseOrder.findFirst({
      where: { number: 'PC-0001' },
      include: { lines: true },
    });
    const lineId = po!.lines[0]!.id;
    await prisma.itemLedgerEntry.deleteMany({
      where: {
        tenantId: po!.tenantId,
        documentType: 'PURCHASE_ORDER_LINE',
        documentId: lineId,
      },
    });
    await prisma.purchaseOrder.update({
      where: { id: po!.id },
      data: { status: DocumentStatus.OPEN },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/purchases/orders/${po!.id}/receive`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ lines: [{ lineId, quantity: '1' }] })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/purchases/orders/${po!.id}/receive`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ lines: [{ lineId, quantity: '0.0001' }] })
      .expect(400);
  });

  it('denies receive without purchases.write', async () => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'demo' } });
    const email = `purch-read-${Date.now()}@integration.test`;
    const passwordHash = await argon2.hash('PurchRead123!');
    const readRole = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: `Purch read only ${Date.now()}`,
        description: 'integration',
      },
    });
    const readPerm = await prisma.permission.findUniqueOrThrow({
      where: { code: 'purchases.read' },
    });
    await prisma.rolePermission.create({
      data: { roleId: readRole.id, permissionId: readPerm.id },
    });
    const user = await prisma.user.create({
      data: {
        email,
        displayName: 'Purch read',
        passwordHash,
      },
    });
    await prisma.userTenant.create({
      data: { userId: user.id, tenantId: tenant.id, isDefault: true },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleId: readRole.id } });
    const company = await prisma.company.findFirstOrThrow({ where: { tenantId: tenant.id } });
    await prisma.userCompany.create({ data: { userId: user.id, companyId: company.id } });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'PurchRead123!', tenantSlug: 'demo' })
      .expect(200);

    const po = await prisma.purchaseOrder.findFirstOrThrow({
      where: { number: 'PC-0001' },
      include: { lines: true },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/purchases/orders/${po.id}/receive`)
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .send({ lines: [{ lineId: po.lines[0]!.id, quantity: '1' }] })
      .expect(403);

    await prisma.user.delete({ where: { id: user.id } });
  });
});
