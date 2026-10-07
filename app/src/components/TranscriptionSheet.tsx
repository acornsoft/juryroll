import { BLANK_SHEET_ROWS, GRID_COLUMNS } from '../lib/transcribe.ts';

export function TranscriptionSheet() {
  return (
    <section id="transcriptionSheet" aria-hidden="true">
      <h1>JuryRoll transcription sheet</h1>
      <p>Blank sheet for a printed non-juror list. Type the rows into JuryRoll later. Do not write a voter’s contact information here.</p>
      <p>County: ______________ State: ______________ Date: ______________</p>
      <table className="sheet-table">
        <thead>
          <tr>
            {GRID_COLUMNS.map((column) => <th key={column.key}>{column.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: BLANK_SHEET_ROWS }, (_, index) => (
            <tr key={index}>
              {GRID_COLUMNS.map((column) => <td key={column.key}>&nbsp;</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
