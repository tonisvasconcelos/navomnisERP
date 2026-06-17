/** Map legacy ERP unit abbreviations (Unidade NF) to standard UOM codes. */
export const LEGACY_UOM_TO_CODE: Record<string, string> = {
  kg: 'KG',
  g: 'KG',
  un: 'UN',
  und: 'UN',
  unidade: 'UN',
  cx: 'CX',
  crt: 'CX',
  car: 'CX',
  bdj: 'BDJ',
  bd: 'BDJ',
  bandeja: 'BDJ',
  mol: 'MOL',
  molho: 'MOL',
  dz: 'DZ',
  duzia: 'DZ',
  sc: 'SC',
  saco: 'SC',
  pct: 'PCT',
  pacote: 'PCT',
  pc: 'UN',
};

export function legacyAliasToUomCode(alias: string): string | null {
  const key = alias.trim().toLowerCase();
  if (!key) return null;
  return LEGACY_UOM_TO_CODE[key] ?? null;
}
