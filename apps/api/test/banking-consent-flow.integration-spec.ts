import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { BankConsentStatus } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { createIntegrationApp } from './helpers/create-integration-app';

const run =
  process.env.CI === 'true' ||
  process.env.RUN_INTEGRATION === '1' ||
  process.env.RUN_INTEGRATION === 'true';

const DEMO_COMPANY = '00000000-0000-4000-8000-000000000020';

(run ? describe : describe.skip)('Banking Open Finance consent (HTTP)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;

  beforeAll(async () => {
    process.env.OPEN_FINANCE_ENABLED = 'true';
    process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'integration-banking-vault-key-32b';
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

  it('lists sandbox institutions when enabled', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/banking/institutions')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it('starts consent and completes OAuth callback', async () => {
    const inst = await prisma.financialInstitution.findFirstOrThrow({
      where: { participantId: 'sandbox-nubank' },
    });

    const start = await request(app.getHttpServer())
      .post('/api/v1/banking/connections')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ companyId: DEMO_COMPANY, institutionId: inst.id })
      .expect(200);

    const consentId = start.body.data.consentId as string;
    const session = await prisma.bankOAuthSession.findUniqueOrThrow({
      where: { consentId },
    });

    await request(app.getHttpServer())
      .get('/api/v1/banking/oauth/callback')
      .query({ state: session.state, code: 'sandbox-auth-code' })
      .expect(302);

    const consent = await prisma.bankConsent.findUniqueOrThrow({ where: { id: consentId } });
    expect(consent.status).toBe(BankConsentStatus.AUTHORISED);
    expect(await prisma.bankCredentialVault.findUnique({ where: { consentId } })).toBeTruthy();
  });

});
