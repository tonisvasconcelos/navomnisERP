import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createIntegrationApp } from './helpers/create-integration-app';

const run =
  process.env.CI === 'true' ||
  process.env.RUN_INTEGRATION === '1' ||
  process.env.RUN_INTEGRATION === 'true';

(run ? describe : describe.skip)('POST /auth/login — rate limit (HTTP)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createIntegrationApp();
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  it('returns 429 when login attempts exceed the short window limit', async () => {
    const server = app.getHttpServer();
    const body = {
      email: 'admin@demo.navomnis.local',
      password: 'wrong-password-intentionally',
      tenantSlug: 'demo',
    };

    for (let i = 0; i < 15; i += 1) {
      await request(server).post('/api/v1/auth/login').send(body).expect(401);
    }

    const blocked = await request(server).post('/api/v1/auth/login').send(body).expect(429);
    const retryAfter = blocked.headers['retry-after'] ?? blocked.headers['Retry-After'];
    expect(retryAfter).toBeTruthy();
  });
});
