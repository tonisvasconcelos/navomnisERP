import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DocumentStatus } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createIntegrationApp } from './helpers/create-integration-app';
import { getDemoUnUomId } from './helpers/integration-uom';

const run =
  process.env.CI === 'true' ||
  process.env.RUN_INTEGRATION === '1' ||
  process.env.RUN_INTEGRATION === 'true';

(run ? describe : describe.skip)('Purchase order lifecycle (HTTP)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let companyId: string;
  let vendorId: string;
  let itemId: string;
  let unUomId: string;

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

    const companies = await request(app.getHttpServer())
      .get('/api/v1/parties/companies')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    companyId = companies.body.data[0].id as string;

    const vendors = await request(app.getHttpServer())
      .get('/api/v1/parties/vendors')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    vendorId = vendors.body.data[0].id as string;

    const items = await request(app.getHttpServer())
      .get('/api/v1/inventory/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    itemId = items.body.data[0].id as string;
    unUomId = await getDemoUnUomId(prisma);
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  it('creates draft PO, adds line, releases to OPEN', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/v1/purchases/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ companyId, vendorId })
      .expect(200);

    const orderId = create.body.data.id as string;
    expect(create.body.data.status).toBe(DocumentStatus.DRAFT);

    const addLine = await request(app.getHttpServer())
      .post(`/api/v1/purchases/orders/${orderId}/lines`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ itemId, quantity: '2', unitCost: '5', transactionUomId: unUomId })
      .expect(200);

    expect(addLine.body.data.lines[0].transactionUomId).toBe(unUomId);
    expect(addLine.body.data.lines[0].baseUomId).toBeTruthy();
    expect(addLine.body.data.lines[0].baseQuantity).toBeTruthy();

    const release = await request(app.getHttpServer())
      .post(`/api/v1/purchases/orders/${orderId}/release`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(release.body.data.status).toBe(DocumentStatus.OPEN);

    await prisma.purchaseOrder.delete({ where: { id: orderId } }).catch(() => undefined);
  });
});
