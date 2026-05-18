import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createIntegrationApp } from './helpers/create-integration-app';

const run =
  process.env.CI === 'true' ||
  process.env.RUN_INTEGRATION === '1' ||
  process.env.RUN_INTEGRATION === 'true';

(run ? describe : describe.skip)('Platform auth isolation (HTTP)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createIntegrationApp();
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  it('tenant JWT cannot access platform tenants API', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@demo.navomnis.local',
        password: 'Admin123!',
        tenantSlug: 'demo',
      })
      .expect(200);

    const tenantToken = login.body.data.accessToken as string;
    await request(app.getHttpServer())
      .get('/api/v1/platform/tenants')
      .set('Authorization', `Bearer ${tenantToken}`)
      .expect(401);
  });

  it('platform JWT cannot access tenant sales write', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/platform/auth/login')
      .send({
        email: 'admin@platform.navomnis.local',
        password: 'Platform123!',
      })
      .expect(200);

    const platformToken = login.body.data.accessToken as string;
    await request(app.getHttpServer())
      .get('/api/v1/platform/tenants')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(401);
  });

  it('platform login returns permissions', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/platform/auth/login')
      .send({
        email: 'admin@platform.navomnis.local',
        password: 'Platform123!',
      })
      .expect(200);

    const token = login.body.data.accessToken as string;
    const me = await request(app.getHttpServer())
      .get('/api/v1/platform/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = me.body.data as { permissions: string[] };
    expect(body.permissions).toEqual(
      expect.arrayContaining(['platform.tenants.read', 'platform.telemetry.read']),
    );
  });
});
