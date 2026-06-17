import { legacyAliasToUomCode } from './cadeg-legacy-uom.map';

describe('cadeg-legacy-uom.map', () => {
  it('maps hortifruti abbreviations', () => {
    expect(legacyAliasToUomCode('Bdj')).toBe('BDJ');
    expect(legacyAliasToUomCode('Mol')).toBe('MOL');
    expect(legacyAliasToUomCode('Sc')).toBe('SC');
  });
});
