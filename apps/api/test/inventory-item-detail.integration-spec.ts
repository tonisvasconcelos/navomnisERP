import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createIntegrationApp } from './helpers/create-integration-app';

const run =
  process.env.CI === 'true' ||
  process.env.RUN_INTEGRATION === '1' ||
  process.env.RUN_INTEGRATION === 'true';

(run ? describe : describe.skip)('Inventory item detail (HTTP)', () => {
  let app: INestApplication;
  let accessToken: string;
  let itemId: string;

  beforeAll(async () => {
    app = await createIntegrationApp();
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@demo.navomnis.local',
        password: 'Admin123!',
        tenantSlug: 'demo',
      });
    accessToken = login.body.data.accessToken as string;

    const items = await request(app.getHttpServer())
      .get('/api/v1/inventory/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const item = (items.body.data as { id: string; sku: string }[]).find((i) => i.sku === 'ITEM-001');
    expect(item).toBeDefined();
    itemId = item!.id;
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  it('returns aggregate detail with null primaryImageUrl', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/inventory/items/${itemId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.data.id).toBe(itemId);
    expect(res.body.data.sku).toBe('ITEM-001');
    expect(res.body.data.primaryImageUrl).toBeNull();
    expect(res.body.data.baseUom.code).toBe('UN');
    expect(Array.isArray(res.body.data.recentLedger)).toBe(true);
    expect(Array.isArray(res.body.data.uomConversions)).toBe(true);
  });

  it('returns 404 for unknown item id', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/inventory/items/00000000-0000-4000-8000-000000009999')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });
});
