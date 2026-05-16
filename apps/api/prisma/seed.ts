import {
  BrazilianFiscalRegime,
  BrazilianTaxKind,
  ConsentKind,
  DocumentStatus,
  FiscalDocumentDirection,
  FiscalDocumentKind,
  FiscalJurisdictionLevel,
  PartyKind,
  PrismaClient,
  TaxpayerType,
  TaxRuleBaseStrategy,
  TenantStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const permissions = [
    { code: 'fiscal.read', name: 'Fiscal - leitura' },
    { code: 'fiscal.write', name: 'Fiscal - escrita' },
    { code: 'core.tenant.read', name: 'Ler configuração do tenant' },
    { code: 'finance.read', name: 'Financeiro — leitura' },
    { code: 'sales.read', name: 'Vendas — leitura' },
    { code: 'sales.write', name: 'Vendas — escrita' },
    { code: 'master.read', name: 'Cadastros — leitura' },
    { code: 'master.write', name: 'Cadastros — escrita' },
    { code: 'purchases.read', name: 'Compras — leitura' },
    { code: 'purchases.write', name: 'Compras — escrita' },
    { code: 'inventory.read', name: 'Estoque — leitura' },
    { code: 'audit.read', name: 'Auditoria — leitura' },
    { code: 'lgpd.self', name: 'LGPD — dados próprios' },
    { code: 'banking.read', name: 'Open Finance — leitura' },
    { code: 'banking.connect', name: 'Open Finance — conectar banco' },
    { code: 'banking.reconcile', name: 'Open Finance — conciliação' },
    { code: 'banking.admin', name: 'Open Finance — administração' },
  ];
  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { name: p.name },
      create: p,
    });
  }

  await prisma.legalDocumentVersion.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      kind: ConsentKind.TERMS_OF_SERVICE,
      version: '2026-01-01',
      content: 'Termos de uso (demo). Substitua por texto jurídico válido.',
    },
  });

  await prisma.legalDocumentVersion.upsert({
    where: { id: '00000000-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000002',
      kind: ConsentKind.PRIVACY_POLICY,
      version: '2026-01-01',
      content: 'Política de privacidade LGPD (demo). Substitua por texto jurídico válido.',
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: { status: TenantStatus.ACTIVE },
    create: {
      slug: 'demo',
      name: 'Empresa Demonstração',
      status: TenantStatus.ACTIVE,
      branding: { create: {} },
    },
    include: { branding: true },
  });

  const passwordHash = await argon2.hash('Admin123!');
  const user = await prisma.user.upsert({
    where: { email: 'admin@demo.navomnis.local' },
    update: {},
    create: {
      email: 'admin@demo.navomnis.local',
      passwordHash,
      displayName: 'Administrador',
    },
  });

  await prisma.userTenant.upsert({
    where: {
      userId_tenantId: { userId: user.id, tenantId: tenant.id },
    },
    update: { isDefault: true },
    create: { userId: user.id, tenantId: tenant.id, isDefault: true },
  });

  const adminRole = await prisma.role.upsert({
    where: {
      tenantId_name: { tenantId: tenant.id, name: 'Administrador' },
    },
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
      where: {
        roleId_permissionId: { roleId: adminRole.id, permissionId: p.id },
      },
      update: {},
      create: { roleId: adminRole.id, permissionId: p.id },
    });
  }

  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: user.id, roleId: adminRole.id },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: adminRole.id,
    },
  });

  const company = await prisma.company.upsert({
    where: { id: '00000000-0000-4000-8000-000000000020' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000020',
      tenantId: tenant.id,
      name: 'Matriz',
      isHead: true,
    },
  });

  await prisma.userCompany.upsert({
    where: {
      userId_companyId: { userId: user.id, companyId: company.id },
    },
    update: {},
    create: { userId: user.id, companyId: company.id },
  });

  const coa = [
    { code: '1', name: 'Ativo', isPosting: false },
    { code: '1.1', name: 'Disponibilidades', isPosting: true },
    { code: '2', name: 'Passivo', isPosting: false },
    { code: '3', name: 'Receitas', isPosting: true },
    { code: '4', name: 'Custos e despesas', isPosting: true },
  ];
  for (const row of coa) {
    await prisma.chartOfAccount.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: row.code } },
      update: {},
      create: { tenantId: tenant.id, ...row },
    });
  }

  const item = await prisma.item.upsert({
    where: { tenantId_sku: { tenantId: tenant.id, sku: 'ITEM-001' } },
    update: {},
    create: {
      tenantId: tenant.id,
      sku: 'ITEM-001',
      name: 'Item demonstração',
      baseUom: 'UN',
    },
  });

  const customer = await prisma.party.upsert({
    where: { id: '00000000-0000-4000-8000-000000000030' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000030',
      tenantId: tenant.id,
      kind: PartyKind.CUSTOMER,
      name: 'Cliente Demo',
      taxId: '00000000000191',
      createdById: user.id,
    },
  });

  const vendor = await prisma.party.upsert({
    where: { id: '00000000-0000-4000-8000-000000000031' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000031',
      tenantId: tenant.id,
      kind: PartyKind.SUPPLIER,
      name: 'Fornecedor Demo',
      createdById: user.id,
    },
  });

  const effectiveFrom = new Date('2026-01-01T00:00:00.000Z');
  const federal = await prisma.fiscalJurisdiction.upsert({
    where: { tenantId_code_effectiveFrom: { tenantId: tenant.id, code: 'BR', effectiveFrom } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'BR',
      name: 'Brasil',
      level: FiscalJurisdictionLevel.FEDERAL,
      effectiveFrom,
      metadata: { seed: true, note: 'jurisdicao federal demo' },
    },
  });

  const sp = await prisma.fiscalJurisdiction.upsert({
    where: { tenantId_code_effectiveFrom: { tenantId: tenant.id, code: 'BR-SP', effectiveFrom } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'BR-SP',
      name: 'Sao Paulo',
      level: FiscalJurisdictionLevel.STATE,
      stateCode: 'SP',
      effectiveFrom,
      metadata: { seed: true, note: 'jurisdicao estadual demo' },
    },
  });

  await prisma.fiscalRegimeSetup.upsert({
    where: { id: '00000000-0000-4000-8000-000000000060' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000060',
      tenantId: tenant.id,
      companyId: company.id,
      regime: BrazilianFiscalRegime.LUCRO_REAL,
      validFrom: effectiveFrom,
      isDefault: true,
      notes: 'Regime demo. Substituir por parametrizacao fiscal validada.',
    },
  });

  const businessGroup = await prisma.taxGroup.upsert({
    where: { tenantId_kind_code: { tenantId: tenant.id, kind: 'BUSINESS', code: 'B2B_CONTRIBUINTE' } },
    update: {},
    create: {
      tenantId: tenant.id,
      kind: 'BUSINESS',
      code: 'B2B_CONTRIBUINTE',
      name: 'B2B contribuinte',
      metadata: { seed: true },
    },
  });

  const productGroup = await prisma.taxGroup.upsert({
    where: { tenantId_kind_code: { tenantId: tenant.id, kind: 'PRODUCT', code: 'MERCADORIA_PADRAO' } },
    update: {},
    create: {
      tenantId: tenant.id,
      kind: 'PRODUCT',
      code: 'MERCADORIA_PADRAO',
      name: 'Mercadoria padrao',
      metadata: { seed: true },
    },
  });

  const operationType = await prisma.fiscalOperationType.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'VENDA_MERCADORIA_INTERNA' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'VENDA_MERCADORIA_INTERNA',
      name: 'Venda de mercadoria - operacao interna',
      direction: FiscalDocumentDirection.OUTBOUND,
      defaultCfop: '5102',
      nfModel: '55',
      affectsInventory: true,
      affectsFinancial: true,
      requiresAuthorization: true,
      metadata: { seed: true, scope: 'demo' },
    },
  });

  await prisma.partyFiscalProfile.upsert({
    where: { partyId: customer.id },
    update: {},
    create: {
      tenantId: tenant.id,
      partyId: customer.id,
      cnpj: '00000000000191',
      taxpayerType: TaxpayerType.CONTRIBUTOR,
      fiscalRegime: BrazilianFiscalRegime.LUCRO_REAL,
      businessTaxGroupId: businessGroup.id,
      validFrom: effectiveFrom,
      metadata: { seed: true, note: 'perfil fiscal demo' },
    },
  });

  await prisma.productFiscalProfile.upsert({
    where: { itemId: item.id },
    update: {},
    create: {
      tenantId: tenant.id,
      itemId: item.id,
      ncm: '00000000',
      fiscalOriginCode: '0',
      fiscalCategory: 'MERCADORIA',
      productTaxGroupId: productGroup.id,
      validFrom: effectiveFrom,
      metadata: { seed: true, note: 'NCM placeholder; substituir antes de uso real' },
    },
  });

  for (const [idx, taxKind] of [
    BrazilianTaxKind.ICMS,
    BrazilianTaxKind.PIS,
    BrazilianTaxKind.COFINS,
    BrazilianTaxKind.IBS,
    BrazilianTaxKind.CBS,
    BrazilianTaxKind.IS,
  ].entries()) {
    await prisma.taxDeterminationRule.upsert({
      where: { id: `00000000-0000-4000-8000-00000000007${idx}` },
      update: {},
      create: {
        id: `00000000-0000-4000-8000-00000000007${idx}`,
        tenantId: tenant.id,
        taxKind,
        priority: 100 + idx,
        operationTypeId: operationType.id,
        businessTaxGroupId: businessGroup.id,
        productTaxGroupId: productGroup.id,
        originJurisdictionId: sp.id,
        destinationJurisdictionId: sp.id,
        fiscalRegime: BrazilianFiscalRegime.LUCRO_REAL,
        taxpayerType: TaxpayerType.CONTRIBUTOR,
        cfop: '5102',
        cst: taxKind === BrazilianTaxKind.ICMS ? '00' : undefined,
        baseStrategy: TaxRuleBaseStrategy.LINE_AMOUNT,
        formulaCode: 'STANDARD_PERCENT_RATE',
        rate: '0',
        effectiveFrom,
        legalReference: 'DEMO_ZERO_RATE_NOT_LEGAL_TABLE',
        parameters: {
          seed: true,
          warning: 'Regra estrutural. Informar aliquotas e bases oficiais antes de operacao real.',
          reformReady: [BrazilianTaxKind.IBS, BrazilianTaxKind.CBS, BrazilianTaxKind.IS].includes(taxKind),
          federalJurisdictionId: federal.id,
        },
      },
    });
  }

  await prisma.postingSetup.upsert({
    where: { id: '00000000-0000-4000-8000-000000000080' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000080',
      tenantId: tenant.id,
      businessTaxGroupId: businessGroup.id,
      productTaxGroupId: productGroup.id,
      receivableAccount: '1.1',
      revenueAccount: '3',
      inventoryAccount: '1',
      cogsAccount: '4',
      effectiveFrom,
      metadata: { seed: true, note: 'Configuracao contabil demo' },
    },
  });

  for (const [idx, taxKind] of [
    BrazilianTaxKind.ICMS,
    BrazilianTaxKind.PIS,
    BrazilianTaxKind.COFINS,
    BrazilianTaxKind.IBS,
    BrazilianTaxKind.CBS,
    BrazilianTaxKind.IS,
  ].entries()) {
    await prisma.taxPostingSetup.upsert({
      where: { tenantId_taxKind_effectiveFrom: { tenantId: tenant.id, taxKind, effectiveFrom } },
      update: {},
      create: {
        tenantId: tenant.id,
        taxKind,
        payableAccount: '2',
        recoverableAccount: '1.1',
        expenseAccount: '4',
        settlementAccount: '2',
        effectiveFrom,
        metadata: { seed: true, sequence: idx },
      },
    });
  }

  await prisma.fiscalPostingSetup.upsert({
    where: { id: '00000000-0000-4000-8000-000000000090' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000090',
      tenantId: tenant.id,
      operationTypeId: operationType.id,
      documentKind: FiscalDocumentKind.SALES_INVOICE,
      requiresTaxLedger: true,
      requiresGlPosting: true,
      effectiveFrom,
      fiscalLedgerTemplate: {
        taxLedger: true,
        gl: true,
        customerLedger: true,
        note: 'template demo',
      },
    },
  });

  await prisma.salesOrder.upsert({
    where: { tenantId_number: { tenantId: tenant.id, number: 'PV-0001' } },
    update: {},
    create: {
      tenantId: tenant.id,
      companyId: company.id,
      customerId: customer.id,
      number: 'PV-0001',
      status: DocumentStatus.DRAFT,
      totalAmount: 0,
      lines: {
        create: [
          {
            itemId: item.id,
            quantity: 1,
            unitPrice: 100,
            lineTotal: 100,
          },
        ],
      },
    },
  });

  await prisma.purchaseOrder.upsert({
    where: { tenantId_number: { tenantId: tenant.id, number: 'PC-0001' } },
    update: {},
    create: {
      tenantId: tenant.id,
      companyId: company.id,
      vendorId: vendor.id,
      number: 'PC-0001',
      status: DocumentStatus.OPEN,
      totalAmount: 50,
      lines: {
        create: [
          {
            itemId: item.id,
            quantity: 1,
            unitCost: 50,
            lineTotal: 50,
          },
        ],
      },
    },
  });

  await prisma.itemLedgerEntry.deleteMany({
    where: { tenantId: tenant.id, documentType: 'SEED' },
  });
  await prisma.itemLedgerEntry.create({
    data: {
      tenantId: tenant.id,
      itemId: item.id,
      quantity: 100,
      entryType: 'OPENING',
      documentType: 'SEED',
    },
  });

  await prisma.emailTemplate.upsert({
    where: { key: 'password-reset' },
    update: {},
    create: {
      key: 'password-reset',
      subject: 'Redefinição de senha — Navomnis ERP',
      htmlBody: '<p>Use o link seguro para redefinir sua senha.</p>',
    },
  });

  const tenantRows = await prisma.tenant.findMany({ select: { id: true } });
  for (const t of tenantRows) {
    const n = await prisma.salesOrder.count({ where: { tenantId: t.id } });
    await prisma.documentNumberSeries.upsert({
      where: { tenantId_code: { tenantId: t.id, code: 'SALES_ORDER' } },
      update: { lastNumber: n },
      create: { tenantId: t.id, code: 'SALES_ORDER', lastNumber: n },
    });
  }

  const sandboxInstitutions = [
    {
      participantId: 'sandbox-itau',
      ispb: '60701190',
      compe: '341',
      brandName: 'Itaú (Sandbox)',
      apiBaseUrl: 'https://api.itau.com.br/open-banking/sandbox',
    },
    {
      participantId: 'sandbox-bradesco',
      ispb: '60746948',
      compe: '237',
      brandName: 'Bradesco (Sandbox)',
      apiBaseUrl: 'https://api.bradesco.com.br/open-banking/sandbox',
    },
    {
      participantId: 'sandbox-nubank',
      ispb: '18236120',
      compe: '260',
      brandName: 'Nubank (Sandbox)',
      apiBaseUrl: 'https://api.nubank.com.br/open-banking/sandbox',
    },
  ];
  for (const inst of sandboxInstitutions) {
    await prisma.financialInstitution.upsert({
      where: { participantId: inst.participantId },
      update: { brandName: inst.brandName, apiBaseUrl: inst.apiBaseUrl, isSandbox: true },
      create: {
        participantId: inst.participantId,
        ispb: inst.ispb,
        compe: inst.compe,
        brandName: inst.brandName,
        apiBaseUrl: inst.apiBaseUrl,
        supportedScopes: ['accounts', 'credit-cards-accounts', 'loans', 'financings'],
        isSandbox: true,
      },
    });
  }

  console.log('Seed concluído. Tenant demo / admin@demo.navomnis.local / Admin123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
