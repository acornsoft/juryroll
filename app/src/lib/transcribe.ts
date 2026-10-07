export const GRID_COLUMNS = [
  { key: 'jurorId', header: 'Juror Number' },
  { key: 'last', header: 'Last' },
  { key: 'first', header: 'First' },
  { key: 'mi', header: 'MI' },
  { key: 'sfx', header: 'Sfx' },
  { key: 'dob', header: 'Birth Date' },
  { key: 'age', header: 'Age' },
  { key: 'address', header: 'Address' },
  { key: 'zip', header: 'Zip' },
  { key: 'reason', header: 'Disqualification Reason' },
  { key: 'decl', header: 'Disqualification Date' },
] as const;

export const BLANK_SHEET_ROWS = 15;

export function emptyTypedRow(): string[] {
  return GRID_COLUMNS.map(() => '');
}

export function blankGrid(): string[][] {
  return [emptyTypedRow()];
}

export function isBlankRow(row: readonly string[]): boolean {
  return row.every((cell) => cell.trim() === '');
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function gridToCsv(rows: readonly (readonly string[])[]): string {
  const lines = [GRID_COLUMNS.map((column) => column.header).join(',')];
  for (const row of rows) {
    if (isBlankRow(row)) continue;
    lines.push(GRID_COLUMNS.map((_, index) => csvCell(row[index] ?? '')).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

export function parsePaste(text: string): string[][] {
  const trimmed = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n$/, '');
  if (!trimmed.trim()) return [];
  const lines = trimmed.split('\n').map((line) => (line.includes('\t') ? line.split('\t') : splitCsvLine(line)));
  const headers = GRID_COLUMNS.map((column) => column.header.toLowerCase());
  const first = (lines[0] ?? []).map((cell) => cell.trim().toLowerCase());
  const headerHits = first.filter((cell) => headers.includes(cell)).length;
  if (headerHits >= 2) {
    const positions = first.map((cell) => headers.indexOf(cell));
    return lines.slice(1).map((row) => {
      const cells = emptyTypedRow();
      row.forEach((cell, index) => {
        const position = positions[index];
        if (position !== undefined && position >= 0) cells[position] = cell.trim();
      });
      return cells;
    }).filter((row) => !isBlankRow(row));
  }
  return lines.map((row) => {
    const cells = row.slice(0, GRID_COLUMNS.length).map((cell) => cell.trim());
    while (cells.length < GRID_COLUMNS.length) cells.push('');
    return cells;
  }).filter((row) => !isBlankRow(row));
}

export function applyPaste(rows: readonly (readonly string[])[], startRow: number, startCol: number, pasted: readonly (readonly string[])[]): string[][] {
  const next = rows.map((row) => row.slice());
  pasted.forEach((pastedRow, offset) => {
    const rowIndex = startRow + offset;
    while (next.length <= rowIndex) next.push(emptyTypedRow());
    pastedRow.forEach((cell, cellOffset) => {
      const column = startCol + cellOffset;
      if (column < 0 || column >= GRID_COLUMNS.length) return;
      next[rowIndex][column] = cell;
    });
  });
  return next.length ? next : blankGrid();
}

export function rowAfterEnter(rowIndex: number, rowCount: number): { rowIndex: number; rowCount: number } {
  if (rowIndex + 1 >= rowCount) return { rowIndex: rowIndex + 1, rowCount: rowCount + 1 };
  return { rowIndex: rowIndex + 1, rowCount };
}
