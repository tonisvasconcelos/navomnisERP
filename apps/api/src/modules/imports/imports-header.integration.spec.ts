import { mapSalesCsvHeader, salesOrderNumberFromNf } from './legacy-csv-header.mapper';

describe('imports header persistence (unit)', () => {
  it('produces create payload fields for SalesOrder from CSV row', () => {
    const payload = {
      NF: '000617342/',
      'Dt Emissão': '15/01/2026',
      'Dt Saida': '16/01/2026',
      'Hora Saida': '08:30',
      Cfop: '5102',
      'Chave NFE': '35260101234567890123456789012345678901234567',
      Local: 'centro',
      Atendente: 'Maria',
      Frete: '10,50',
    };

    const header = mapSalesCsvHeader(payload);
    expect(salesOrderNumberFromNf('000617342/')).toBe('SO-000617342');
    expect(header.invoiceNumber).toBe('000617342/');
    expect(header.cfop).toBe('5102');
    expect(header.fiscalKey).toBe('35260101234567890123456789012345678901234567');
    expect(header.freightAmount?.toString()).toBe('10.5');
    expect(header.shippedAt?.getUTCHours()).toBe(8);
  });
});
