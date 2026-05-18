import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createIntegrationApp } from './helpers/create-integration-app';

const run =
  process.env.CI === 'true' ||
  process.env.RUN_INTEGRATION === '1' ||
  process.env.RUN_INTEGRATION === 'true';

(run ? describe : describe.skip)('Platform user invite (HTTP)', () => {
  let app: INestApplication;
  let platformToken: string;
  let tenantId: string;

  beforeAll(async () => {
    app = await createIntegrationApp();
    const login = await request(app.getHttpServer())
      .post('/api/v1/platform/auth/login')
      .send({
        email: 'admin@platform.navomnis.local',
        password: 'Platform123!',
      })
      .expect(200);
    platformToken = login.body.data.accessToken as string;

    const tenants = await request(app.getHttpServer())
      .get('/api/v1/platform/tenants')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200);
    tenantId = tenants.body.data.items[0].id as string;
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  it('invite → validate → accept → login', async () => {
    const email = `invite.test+${Date.now()}@navomnis.local`;
    const inviteRes = await request(app.getHttpServer())
      .post('/api/v1/platform/users/invite')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({
        email,
        displayName: 'Convidado Teste',
        tenantId,
      })
      .expect(200);

    const token = inviteRes.body.data.token as string;
    expect(inviteRes.body.data.inviteUrl).toContain(token);

    await request(app.getHttpServer())
      .get('/api/v1/auth/invite/validate')
      .query({ token })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/invite/accept')
      .send({ token, password: 'InviteTest123!' })
      .expect(200);

    const tenant = await request(app.getHttpServer())
      .get(`/api/v1/platform/tenants/${tenantId}`)
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200);

    const slug = tenant.body.data.slug as string;

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email,
        password: 'InviteTest123!',
        tenantSlug: slug,
      })
      .expect(200);
  });
});
