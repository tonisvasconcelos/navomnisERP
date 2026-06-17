import { parseSemicolonCsv, salesRowIdempotencyKey } from './csv-parser.util';

describe('csv-parser.util', () => {
  it('skips timestamp header row', () => {
    const text = `18/05/2026 10:00:00
Cod. Prod;Produto;Qtd;Unidade NF
100;Tomate;2,5;Kg`;
    const { headers, rows } = parseSemicolonCsv(text);
    expect(headers).toContain('Cod. Prod');
    expect(rows).toHaveLength(1);
    expect(rows[0]!['Qtd']).toBe('2.5');
  });

  it('dedupes duplicate headers', () => {
    const text = 'Local;Local;Qtd\nA;B;1';
    const { headers } = parseSemicolonCsv(text);
    expect(headers).toEqual(['Local', 'Local_2', 'Qtd']);
  });

  it('builds idempotency key from NF and product', () => {
    const key = salesRowIdempotencyKey({ NF: '123', 'Cod. Prod': '99' });
    expect(key).toBe('123::99');
  });
});
