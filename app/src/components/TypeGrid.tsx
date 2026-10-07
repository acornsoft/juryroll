import { GRID_COLUMNS, applyPaste, emptyTypedRow, parsePaste, rowAfterEnter } from '../lib/transcribe.ts';

export function TypeGrid({ rows, onChange }: { rows: string[][]; onChange: (rows: string[][]) => void }) {
  function updateCell(rowIndex: number, column: number, value: string) {
    const next = rows.map((row) => row.slice());
    while (next.length <= rowIndex) next.push(emptyTypedRow());
    next[rowIndex][column] = value;
    onChange(next);
  }

  function onEnter(rowIndex: number, column: number) {
    const moved = rowAfterEnter(rowIndex, rows.length);
    const next = rows.map((row) => row.slice());
    while (next.length < moved.rowCount) next.push(emptyTypedRow());
    if (next.length !== rows.length) onChange(next);
    const id = `type-${column}-${moved.rowIndex}`;
    window.setTimeout(() => document.getElementById(id)?.focus(), 0);
  }

  return (
    <div className="type-wrap" id="typeGrid">
      <table className="type-grid">
        <thead>
          <tr>
            {GRID_COLUMNS.map((column) => <th key={column.key}>{column.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {GRID_COLUMNS.map((column, columnIndex) => (
                <td key={column.key}>
                  <input
                    id={`type-${columnIndex}-${rowIndex}`}
                    aria-label={`${column.header} row ${rowIndex + 1}`}
                    value={row[columnIndex] ?? ''}
                    onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        onEnter(rowIndex, columnIndex);
                      }
                    }}
                    onPaste={(event) => {
                      const text = event.clipboardData.getData('text/plain');
                      if (!text.includes('\n') && !text.includes('\t')) return;
                      event.preventDefault();
                      onChange(applyPaste(rows, rowIndex, columnIndex, parsePaste(text)));
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
