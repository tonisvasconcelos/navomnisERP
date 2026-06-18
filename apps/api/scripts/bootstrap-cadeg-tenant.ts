import { NestFactory } from '@nestjs/core';
import {
  ConsentKind,
  TenantStatus,
  TenantSubscriptionStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { CadegMasterDataService } from '../src/modules/cadeg/cadeg-master-data.service';
import { PrismaService } from '../src/prisma/prisma.service';

const TENANT_SLUG = 'cadeg';
const TENANT_NAME = 'CADEG';
const INITIAL_PASSWORD = process.env.CADEG_USER_PASSWORD ?? 'Cadeg2026!';

const USERS = [
  {
    email: 'antoniovasconcelos@avconsulting.com.br',
    displayName: 'Antonio Vasconcelos',
  },
  {
    email: 'tester@tester.com',
    displayName: 'Joao da Silva',
  },
] as const;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const cadeg = app.get(CadegMasterDataService);
    const passwordHash = await argon2.hash(INITIAL_PASSWORD);

    const tenant = await prisma.tenant.upsert({
      where: { slug: TENANT_SLUG },
      update: { name: TENANT_NAME, status: TenantStatus.ACTIVE },
      create: {
        slug: TENANT_SLUG,
        name: TENANT_NAME,
        status: TenantStatus.ACTIVE,
        branding: { create: {} },
      },
    });

    const starterPlan = await prisma.subscriptionPlan.findUnique({ where: { code: 'starter' } });
    if (starterPlan) {
      await prisma.tenantSubscription.upsert({
        where: { tenantId: tenant.id },
        update: { planId: starterPlan.id, status: TenantSubscriptionStatus.ACTIVE },
        create: {
          tenantId: tenant.id,
          planId: starterPlan.id,
          status: TenantSubscriptionStatus.ACTIVE,
        },
      });
    }

    const adminRole = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Administrador' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Administrador',
        description: 'Acesso total',
      },
    });

    const allPerms = await prisma.permission.findMany();
    for (const p of allPerms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } },
        update: {},
        create: { roleId: adminRole.id, permissionId: p.id },
      });
    }

    let company = await prisma.company.findFirst({
      where: { tenantId: tenant.id, name: 'Matriz', deletedAt: null },
    });
    if (!company) {
      company = await prisma.company.create({
        data: { tenantId: tenant.id, name: 'Matriz', isHead: true },
      });
    }

    const legalDocs = await prisma.legalDocumentVersion.findMany({
      where: { status: 'PUBLISHED' },
      take: 2,
    });

    const createdUsers: { email: string; displayName: string; id: string }[] = [];

    for (const u of USERS) {
      const email = u.email.toLowerCase();
      const user = await prisma.user.upsert({
        where: { email },
        update: { displayName: u.displayName, passwordHash },
        create: {
          email,
          displayName: u.displayName,
          passwordHash,
        },
      });

      await prisma.userTenant.upsert({
        where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
        update: { isDefault: true },
        create: { userId: user.id, tenantId: tenant.id, isDefault: true },
      });

      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
        update: {},
        create: { userId: user.id, roleId: adminRole.id },
      });

      await prisma.userCompany.upsert({
        where: { userId_companyId: { userId: user.id, companyId: company.id } },
        update: {},
        create: { userId: user.id, companyId: company.id },
      });

      for (const doc of legalDocs) {
        const existing = await prisma.consentRecord.findFirst({
          where: {
            userId: user.id,
            tenantId: tenant.id,
            kind: doc.kind,
            version: doc.version,
          },
        });
        if (!existing) {
          await prisma.consentRecord.create({
            data: {
              userId: user.id,
              tenantId: tenant.id,
              kind: doc.kind,
              version: doc.version,
              legalDocumentVersionId: doc.id,
            },
          });
        }
      }

      createdUsers.push({ email, displayName: u.displayName, id: user.id });
    }

    const dataDir = process.argv.find((a) => a.startsWith('--data-dir='))?.split('=')[1];
    const skipMaster = process.argv.includes('--skip-master');
    let provisionResult: unknown = null;

    if (!skipMaster) {
      provisionResult = await cadeg.provisionTenant(tenant.id, { dataDir });
    }

    console.log(
      JSON.stringify(
        {
          tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
          users: createdUsers,
          initialPassword: INITIAL_PASSWORD,
          provision: provisionResult,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
