import * as XLSX from 'xlsx';

export type WorkbookCsv = { sheetNames: string[]; csvBySheet: Record<string, string> };

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function cellToString(cell: XLSX.CellObject | undefined, date1904: boolean): string {
  if (!cell || cell.v === undefined || cell.v === null || cell.v === '') return '';
  const format = typeof cell.z === 'string' ? cell.z : '';
  if (cell.t === 'n' && typeof cell.v === 'number' && format && XLSX.SSF.is_date(format)) {
    const parsed = XLSX.SSF.parse_date_code(cell.v, { date1904 });
    if (parsed && parsed.y) return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}`;
  }
  if (typeof cell.w === 'string' && cell.w !== '' && cell.t !== 'n') return cell.w;
  if (cell.t === 'b') return cell.v ? 'TRUE' : 'FALSE';
  return cell.w && cell.t !== 'n' ? String(cell.w) : String(cell.v);
}

function escapeCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function sheetToCsv(sheet: XLSX.WorkSheet, date1904: boolean): string {
  const ref = sheet['!ref'];
  if (!ref) return '';
  const range = XLSX.utils.decode_range(ref);
  const lines: string[] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const cells: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      cells.push(escapeCell(cellToString(typeof cell === 'string' ? undefined : cell, date1904)));
    }
    lines.push(cells.join(','));
  }
  return lines.join('\n');
}

export function readWorkbook(data: ArrayBuffer | Uint8Array): WorkbookCsv {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const wb = XLSX.read(bytes, { type: 'array', cellDates: false, cellNF: true, cellText: true });
  const date1904 = Boolean(wb.Workbook && wb.Workbook.WBProps && wb.Workbook.WBProps.date1904);
  const csvBySheet: Record<string, string> = {};
  wb.SheetNames.forEach((name) => {
    csvBySheet[name] = sheetToCsv(wb.Sheets[name], date1904);
  });
  return { sheetNames: wb.SheetNames.slice(), csvBySheet };
}

export function rowsToCsv(rows: string[][]): string {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\n');
}

export function dropColumns(rows: string[][], indexes: number[]): string[][] {
  const drop = new Set(indexes);
  return rows.map((row) => row.filter((_, index) => !drop.has(index)));
}
