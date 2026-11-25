/** One CSV record and the physical line (1-based) where it starts. */
export interface CsvRecord {
  line: number;
  cells: string[];
}

/**
 * Minimal RFC 4180 CSV reader: quoted fields (may span lines), escaped quotes (""), CRLF/LF,
 * BOM. Blank lines are skipped; `line` keeps the real line number for error messages.
 */
export function parseCsvRecords(text: string): CsvRecord[] {
  const BOM = String.fromCharCode(0xfeff);
  const input = text.startsWith(BOM) ? text.slice(1) : text;
  const records: CsvRecord[] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;

  const endRecord = () => {
    row.push(field);
    records.push({ line: recordLine, cells: row });
    row = [];
    field = '';
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
    } else if (ch === '"' && field === '') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      endRecord();
      line++;
      recordLine = line;
    } else {
      field += ch;
    }
  }
  if (inQuotes) throw new Error('CSV: unterminated quote');
  if (field !== '' || row.length > 0) endRecord();
  return records.filter((r) => !(r.cells.length === 1 && r.cells[0] === ''));
}

/** Records without line numbers (see `parseCsvRecords`). */
export function parseCsv(text: string): string[][] {
  return parseCsvRecords(text).map((r) => r.cells);
}
