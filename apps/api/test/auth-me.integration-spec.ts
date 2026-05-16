import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createIntegrationApp } from './helpers/create-integration-app';

const run =
  process.env.CI === 'true' ||
  process.env.RUN_INTEGRATION === '1' ||
  process.env.RUN_INTEGRATION === 'true';

(run ? describe : describe.skip)('GET /auth/me (HTTP)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createIntegrationApp();
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  it('returns permission codes for demo admin', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@demo.navomnis.local',
        password: 'Admin123!',
        tenantSlug: 'demo',
      })
      .expect(200);

    const accessToken = login.body.data.accessToken as string;
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = me.body.data as { permissions: string[]; sub: string; tenantId: string; displayName: string };
    expect(body.sub).toBeTruthy();
    expect(body.tenantId).toBeTruthy();
    expect(body.displayName).toBeTruthy();
    expect(body.permissions).toEqual(expect.arrayContaining(['sales.write', 'sales.read', 'audit.read']));
    expect([...body.permissions].sort()).toEqual(body.permissions);
  });
});
