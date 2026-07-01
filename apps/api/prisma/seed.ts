/**
 * Demo tenant seed only — do NOT run against CADEG production (`prisma db seed`).
 * CADEG rollout: see docs/cadeg-uom-rollout.md (migrate deploy + cadeg:uom-rollout script).
 */
import {
  BrazilianFiscalRegime,
  BrazilianTaxKind,
  ConsentKind,
  LegalDocumentStatus,
  QuotaResource,
  SubscriptionPlanType,
  TenantSubscriptionStatus,
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
    { code: 'approvals.read', name: 'Aprovações — leitura' },
    { code: 'approvals.configure', name: 'Aprovações — configurar políticas' },
    { code: 'purchases.submit_approval', name: 'Compras — submeter aprovação' },
    { code: 'purchases.approve', name: 'Compras — aprovar pedidos' },
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
    update: { status: LegalDocumentStatus.PUBLISHED, publishedAt: new Date() },
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      kind: ConsentKind.TERMS_OF_SERVICE,
      version: '2026-01-01',
      content: 'Termos de uso (demo). Substitua por texto jurídico válido.',
      status: LegalDocumentStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  });

  await prisma.legalDocumentVersion.upsert({
    where: { id: '00000000-0000-4000-8000-000000000002' },
    update: { status: LegalDocumentStatus.PUBLISHED, publishedAt: new Date() },
    create: {
      id: '00000000-0000-4000-8000-000000000002',
      kind: ConsentKind.PRIVACY_POLICY,
      version: '2026-01-01',
      content: 'Política de privacidade LGPD (demo). Substitua por texto jurídico válido.',
      status: LegalDocumentStatus.PUBLISHED,
      publishedAt: new Date(),
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

  const uomDefs = [
    { code: 'KG', name: 'Quilograma', kind: 'WEIGHT' as const },
    { code: 'UN', name: 'Unidade', kind: 'COUNT' as const },
    { code: 'CX', name: 'Caixa', kind: 'PACKAGE' as const },
    { code: 'BDJ', name: 'Bandeja', kind: 'TRAY' as const },
    { code: 'MOL', name: 'Molho', kind: 'BUNCH' as const },
    { code: 'DZ', name: 'Dúzia', kind: 'DOZEN' as const },
    { code: 'SC', name: 'Saco', kind: 'SACK' as const },
    { code: 'PCT', name: 'Pacote', kind: 'PACKAGE' as const },
  ];
  for (const d of uomDefs) {
    await prisma.unitOfMeasure.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: d.code } },
      update: { name: d.name },
      create: { tenantId: tenant.id, code: d.code, name: d.name, kind: d.kind },
    });
  }
  const unUom = await prisma.unitOfMeasure.findUniqueOrThrow({
    where: { tenantId_code: { tenantId: tenant.id, code: 'UN' } },
  });
  const kgUom = await prisma.unitOfMeasure.findUniqueOrThrow({
    where: { tenantId_code: { tenantId: tenant.id, code: 'KG' } },
  });
  await prisma.item.update({
    where: { id: item.id },
    data: { baseUomId: unUom.id },
  });
  await prisma.unitOfMeasureAlias.upsert({
    where: { tenantId_alias: { tenantId: tenant.id, alias: 'Und' } },
    update: { uomId: unUom.id },
    create: { tenantId: tenant.id, uomId: unUom.id, alias: 'Und', source: 'seed' },
  });
  await prisma.itemUomConversion.upsert({
    where: {
      tenantId_itemId_fromUomId_toUomId_validFrom: {
        tenantId: tenant.id,
        itemId: item.id,
        fromUomId: unUom.id,
        toUomId: kgUom.id,
        validFrom: new Date('2026-01-01'),
      },
    },
    update: { factor: 1 },
    create: {
      tenantId: tenant.id,
      itemId: item.id,
      fromUomId: unUom.id,
      toUomId: kgUom.id,
      factor: 1,
      source: 'seed',
      validFrom: new Date('2026-01-01'),
    },
  });

  await prisma.tenantFeatureOverride.upsert({
    where: { tenantId_moduleKey: { tenantId: tenant.id, moduleKey: 'uom_enforcement' } },
    update: { enabled: true },
    create: { tenantId: tenant.id, moduleKey: 'uom_enforcement', enabled: true },
  });

  await prisma.approvalPolicy.upsert({
    where: { id: '00000000-0000-4000-8000-000000000070' },
    update: { isActive: true },
    create: {
      id: '00000000-0000-4000-8000-000000000070',
      tenantId: tenant.id,
      documentType: 'PURCHASE_ORDER',
      name: 'PO padrão demo',
      isActive: true,
      steps: {
        create: [{ sequence: 1, approverUserId: user.id, minApprovals: 1 }],
      },
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
          reformReady:
            taxKind === BrazilianTaxKind.IBS ||
            taxKind === BrazilianTaxKind.CBS ||
            taxKind === BrazilianTaxKind.IS,
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
            transactionUomId: unUom.id,
            baseUomId: unUom.id,
            baseQuantity: 1,
            conversionFactor: 1,
            conversionTrace: { path: 'identity', fromUomId: unUom.id, toUomId: unUom.id },
          },
        ],
      },
    },
  });
  const demoPo = await prisma.purchaseOrder.findFirst({
    where: { tenantId: tenant.id, number: 'PC-0001' },
    include: { lines: true },
  });
  if (demoPo?.lines[0]) {
    await prisma.purchaseOrderLine.update({
      where: { id: demoPo.lines[0].id },
      data: {
        transactionUomId: unUom.id,
        baseUomId: unUom.id,
        baseQuantity: demoPo.lines[0].quantity,
        conversionFactor: 1,
        conversionTrace: { path: 'identity', fromUomId: unUom.id, toUomId: unUom.id },
      },
    });
  }

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

  await prisma.consentRecord.upsert({
    where: { id: '00000000-0000-4000-8000-000000000090' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000090',
      userId: user.id,
      tenantId: tenant.id,
      kind: ConsentKind.TERMS_OF_SERVICE,
      version: '2026-01-01',
      legalDocumentVersionId: '00000000-0000-4000-8000-000000000001',
    },
  });
  await prisma.consentRecord.upsert({
    where: { id: '00000000-0000-4000-8000-000000000091' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000091',
      userId: user.id,
      tenantId: tenant.id,
      kind: ConsentKind.PRIVACY_POLICY,
      version: '2026-01-01',
      legalDocumentVersionId: '00000000-0000-4000-8000-000000000002',
    },
  });

  const platformPerms = [
    { code: 'platform.tenants.read', name: 'Tenants — leitura' },
    { code: 'platform.tenants.write', name: 'Tenants — escrita' },
    { code: 'platform.tenants.lifecycle', name: 'Tenants — ciclo de vida' },
    { code: 'platform.users.read', name: 'Usuários — leitura' },
    { code: 'platform.users.write', name: 'Usuários — escrita' },
    { code: 'platform.users.security', name: 'Usuários — segurança' },
    { code: 'platform.subscriptions.read', name: 'Assinaturas — leitura' },
    { code: 'platform.subscriptions.write', name: 'Assinaturas — escrita' },
    { code: 'platform.telemetry.read', name: 'Telemetria — leitura' },
    { code: 'platform.legal.read', name: 'Legal — leitura' },
    { code: 'platform.legal.write', name: 'Legal — escrita' },
    { code: 'platform.legal.publish', name: 'Legal — publicar' },
    { code: 'platform.lgpd.read', name: 'LGPD — leitura' },
    { code: 'platform.lgpd.dsar', name: 'LGPD — DSAR' },
    { code: 'platform.audit.read', name: 'Auditoria — leitura' },
    { code: 'platform.feature_flags.write', name: 'Feature flags' },
  ];
  for (const p of platformPerms) {
    await prisma.platformPermission.upsert({
      where: { code: p.code },
      update: { name: p.name },
      create: p,
    });
  }
  const superRole = await prisma.platformRole.upsert({
    where: { name: 'PLATFORM_SUPER_ADMIN' },
    update: {},
    create: { name: 'PLATFORM_SUPER_ADMIN', description: 'Acesso total à plataforma' },
  });
  const allPlatformPerms = await prisma.platformPermission.findMany();
  for (const p of allPlatformPerms) {
    await prisma.platformRolePermission.upsert({
      where: { roleId_permissionId: { roleId: superRole.id, permissionId: p.id } },
      update: {},
      create: { roleId: superRole.id, permissionId: p.id },
    });
  }
  const platformPassword = await argon2.hash('Platform123!');
  const platformOp = await prisma.platformOperator.upsert({
    where: { email: 'admin@platform.navomnis.local' },
    update: {},
    create: {
      email: 'admin@platform.navomnis.local',
      passwordHash: platformPassword,
      displayName: 'Platform Admin',
    },
  });
  await prisma.platformOperatorRole.upsert({
    where: { operatorId_roleId: { operatorId: platformOp.id, roleId: superRole.id } },
    update: {},
    create: { operatorId: platformOp.id, roleId: superRole.id },
  });

  const starterPlan = await prisma.subscriptionPlan.upsert({
    where: { code: 'starter' },
    update: {},
    create: {
      code: 'starter',
      name: 'Starter',
      planType: SubscriptionPlanType.STARTER,
      priceCents: 9900,
      trialDays: 14,
      features: {
        create: [
          { moduleKey: 'sales', enabled: true },
          { moduleKey: 'purchases', enabled: true },
          { moduleKey: 'inventory', enabled: true },
          { moduleKey: 'banking', enabled: false },
        ],
      },
      quotas: {
        create: [
          { resource: QuotaResource.USERS, limitValue: 10 },
          { resource: QuotaResource.COMPANIES, limitValue: 3 },
          { resource: QuotaResource.API_CALLS, limitValue: 100_000 },
        ],
      },
    },
  });
  await prisma.tenantSubscription.upsert({
    where: { tenantId: tenant.id },
    update: { planId: starterPlan.id, status: TenantSubscriptionStatus.ACTIVE },
    create: {
      tenantId: tenant.id,
      planId: starterPlan.id,
      status: TenantSubscriptionStatus.ACTIVE,
    },
  });

  await prisma.dataRetentionPolicy.upsert({
    where: { category: 'audit_logs' },
    update: {},
    create: { category: 'audit_logs', retentionDays: 365, description: 'Logs de auditoria' },
  });

  console.log('Seed concluído.');
  console.log('  Tenant ERP: demo / admin@demo.navomnis.local / Admin123!');
  console.log('  Platform: admin@platform.navomnis.local / Platform123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
