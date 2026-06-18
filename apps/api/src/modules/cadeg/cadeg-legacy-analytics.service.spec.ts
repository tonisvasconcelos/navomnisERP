import type { ParsedCsvRow } from '../imports/csv-parser.util';
import { CadegLegacyAnalyticsService } from './cadeg-legacy-analytics.service';

describe('CadegLegacyAnalyticsService', () => {
  const service = new CadegLegacyAnalyticsService();

  it('aggregates sales rows by SKU and month', () => {
    const rows: ParsedCsvRow[] = [
      {
        'Cod. Prod': '1118',
        Qtd: '2',
        'Total Custo FOB': '16',
        Fornecedor: 'Agro Rezende',
        Mês: '1',
        Ano: '2026',
        'Unidade NF': 'Sc',
      },
      {
        'Cod. Prod': '1118',
        Qtd: '3',
        'Valor Custo FOB': '8',
        Fornecedor: 'Agro Rezende',
        Mês: '1',
        Ano: '2026',
        'Unidade NF': 'Sc',
      },
    ];

    const map = service.aggregateSalesRows(rows);
    const agg = service.lookupAggregate(map, '1118', 2026, 1);
    expect(agg?.totalQtySold.toString()).toBe('5');
    expect(agg?.totalCostFob.toString()).toBe('40');
    expect(agg?.topSupplier).toBe('Agro Rezende');
    expect(service.avgUnitCostFob(agg)?.toString()).toBe('8');
  });
});
