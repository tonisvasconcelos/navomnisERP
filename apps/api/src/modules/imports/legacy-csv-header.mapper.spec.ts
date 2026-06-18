import {
  csvField,
  mapSalesCsvHeader,
  parseBrDate,
  parseBrDateTime,
  parseBrDecimal,
  parseBrDecimalOrZero,
  salesOrderNumberFromNf,
} from './legacy-csv-header.mapper';

describe('legacy-csv-header.mapper', () => {
  const sampleRow = {
    'Cod. Cliente': '620379',
    Cliente: 'Animax FAST-FOOD E Eventos Ltda.',
    'Cod. Prod': '1118',
    Produto: 'Broto de Feijao',
    Qtd: '2',
    'Valor Venda': '9,14',
    'Total Prod': '18,28',
    Local: 'bacalhau',
    'Fantasia do Local': 'Piadina Romagnola',
    'Tipo de Venda': 'Revenda',
    NF: '000060463/',
    'Dt Emissão': '01/01/2026',
    'Dt Saida': '02/01/2026',
    'Hora Saida': '07:19',
    Cfop: '5102',
    'Sit. Trib.': '40',
    Vencimentos: '11/01/2026',
    Pagamentos: '12/01/2026',
    'Dt Faturamento': '01/01/2026',
    'Hora Faturamento': '19:33',
    'Dt Entrega do Pedido': '02/01/2026',
    Frete: '0',
    Desconto: '0',
    'Chave NFE': '33260123122170000144550010000604631006808428',
    Atendente: 'DIANA',
    Digitador: 'LUCAS',
    'Código do Pedido': '23534',
    Cidade: 'Rio de Janeiro',
    UF: 'RJ',
    Equipe: 'ZONA SUL',
  };

  it('maps demo-core header fields from CADEG sales row', () => {
    const header = mapSalesCsvHeader(sampleRow);
    expect(header.invoiceNumber).toBe('000060463/');
    expect(header.orderDate.toISOString()).toContain('2026-01-01');
    expect(header.shippedAt?.toISOString()).toContain('2026-01-02');
    expect(header.invoicedAt?.getUTCHours()).toBe(19);
    expect(header.cfop).toBe('5102');
    expect(header.fiscalKey).toBe('33260123122170000144550010000604631006808428');
    expect(header.salesRep).toBe('DIANA');
    expect(header.warehouseCode).toBe('bacalhau');
    expect(header.externalOrderRef).toBe('23534');
    expect(header.legacyMetadata).toBeDefined();
    expect(header.legacyMetadata).toHaveProperty('Equipe', 'ZONA SUL');
  });

  it('parses Brazilian decimals including thousands separator', () => {
    expect(parseBrDecimalOrZero('1.000,00').toString()).toBe('1000');
    expect(parseBrDecimal('9,14')?.toString()).toBe('9.14');
  });

  it('builds sales order number from NF', () => {
    expect(salesOrderNumberFromNf('000617342/')).toBe('SO-000617342');
  });

  it('combines date and time for shippedAt', () => {
    const dt = parseBrDateTime('02/01/2026', '07:19');
    expect(dt?.getUTCHours()).toBe(7);
    expect(dt?.getUTCMinutes()).toBe(19);
  });

  it('csvField finds columns with explicit labels', () => {
    expect(csvField({ 'Dt Emissão': '01/01/2026' }, 'Dt Emissão', 'Dt Emissao')).toBe('01/01/2026');
  });

  it('parseBrDate returns undefined for invalid input', () => {
    expect(parseBrDate('')).toBeUndefined();
  });
});
