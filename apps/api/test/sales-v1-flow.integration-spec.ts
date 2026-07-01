import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createIntegrationApp } from './helpers/create-integration-app';

const run =
  process.env.CI === 'true' ||
  process.env.RUN_INTEGRATION === '1' ||
  process.env.RUN_INTEGRATION === 'true';

const DEMO_COMPANY = '00000000-0000-4000-8000-000000000020';
const DEMO_CUSTOMER = '00000000-0000-4000-8000-000000000030';

(run ? describe : describe.skip)('V1 sales flow (HTTP)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createIntegrationApp();
    prisma = app.get(PrismaService);
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  it('login → create order → line → release → ledger + logout', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@demo.navomnis.local',
        password: 'Admin123!',
        tenantSlug: 'demo',
      })
      .expect(200);

    const accessToken = login.body.data.accessToken as string;
    const refreshToken = login.body.data.refreshToken as string;

    const itemsRes = await request(app.getHttpServer())
      .get('/api/v1/inventory/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const items = itemsRes.body.data as { id: string; sku: string }[];
    const item = items.find((i) => i.sku === 'ITEM-001');
    expect(item).toBeDefined();

    const uomRes = await request(app.getHttpServer())
      .get(`/api/v1/uom/items/${item!.id}/available`)
      .query({ context: 'sales', partyId: DEMO_CUSTOMER })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const transactionUomId = uomRes.body.data.defaultUomId as string;
    expect(transactionUomId).toBeTruthy();

    const orderRes = await request(app.getHttpServer())
      .post('/api/v1/sales/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ companyId: DEMO_COMPANY, customerId: DEMO_CUSTOMER })
      .expect(200);

    const orderId = orderRes.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/sales/orders/${orderId}/lines`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ itemId: item!.id, quantity: '2', unitPrice: '10', transactionUomId })
      .expect(200);

    const afterLine = await request(app.getHttpServer())
      .get(`/api/v1/sales/orders/${orderId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const line = (afterLine.body.data.lines as {
      id: string;
      transactionUomId?: string;
      baseUomId?: string;
      baseQuantity?: unknown;
    }[])[0]!;
    const lineId = line.id;
    expect(line.transactionUomId).toBe(transactionUomId);
    expect(line.baseUomId).toBeTruthy();
    expect(line.baseQuantity).toBeTruthy();

    await request(app.getHttpServer())
      .patch(`/api/v1/sales/orders/${orderId}/lines/${lineId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ quantity: '3', unitPrice: '10' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/sales/orders/${orderId}/release`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const ledgerRes = await request(app.getHttpServer())
      .get('/api/v1/inventory/ledger')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const ledger = ledgerRes.body.data as {
      documentId: string | null;
      entryType: string;
      transactionUomId?: string | null;
      baseUomId?: string | null;
    }[];
    const releaseEntry = ledger.find((e) => e.documentId === orderId && e.entryType === 'SALES_RELEASE');
    expect(releaseEntry).toBeDefined();
    expect(releaseEntry!.transactionUomId).toBeTruthy();
    expect(releaseEntry!.baseUomId).toBeTruthy();

    const auditCreate = await prisma.auditLog.count({
      where: { entityId: orderId, action: 'sales_order.create' },
    });
    expect(auditCreate).toBeGreaterThanOrEqual(1);
    const auditRelease = await prisma.auditLog.count({
      where: { entityId: orderId, action: 'sales_order.release' },
    });
    expect(auditRelease).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });
});
