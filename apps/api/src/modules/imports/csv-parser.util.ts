/** Parse legacy CADEG CSV (cp1252, semicolon, decimal comma). */
export type ParsedCsvRow = Record<string, string>;

export function decodeCsvBuffer(buffer: Buffer, encoding = 'windows-1252'): string {
  try {
    return new TextDecoder(encoding).decode(buffer);
  } catch {
    return buffer.toString('latin1');
  }
}

export function parseSemicolonCsv(text: string): { headers: string[]; rows: ParsedCsvRow[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };

  let headerLineIdx = 0;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(lines[0]?.trim() ?? '')) {
    headerLineIdx = 1;
  }
  const rawHeaders = splitCsvLine(lines[headerLineIdx] ?? '');
  const headers = dedupeHeaders(rawHeaders.map(normalizeHeader));
  const rows: ParsedCsvRow[] = [];
  for (let i = headerLineIdx + 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i] ?? '');
    if (cols.every((c) => !c.trim())) continue;
    const row: ParsedCsvRow = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = normalizeDecimal(cols[j] ?? '');
    }
    rows.push(row);
  }
  return { headers, rows };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ';' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function normalizeHeader(h: string): string {
  return h.trim().replace(/\s+/g, ' ');
}

function dedupeHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((h) => {
    const count = seen.get(h) ?? 0;
    seen.set(h, count + 1);
    return count === 0 ? h : `${h}_${count + 1}`;
  });
}

function normalizeDecimal(v: string): string {
  const t = v.trim();
  if (!t) return t;
  if (/^\d+,\d+$/.test(t)) return t.replace(',', '.');
  return t;
}

export function salesRowIdempotencyKey(row: ParsedCsvRow): string {
  const nf = row['NF'] ?? row['Nf'] ?? '';
  const line = row['Item'] ?? row['Cod. Prod'] ?? row['Seq'] ?? '';
  return `${nf}::${line}`.trim() || JSON.stringify(row).slice(0, 120);
}
