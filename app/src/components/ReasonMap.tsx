import { PA_PRESET_LABEL, PA_PRESET_NOTE, REASON_CATEGORIES, parseChoice, type ReasonChoice } from '../lib/reasons.ts';

export function ReasonMap({
  rows,
  value,
  onChange,
  onPreset,
}: {
  rows: readonly { value: string; display: string; count: number; formula: boolean }[];
  value: Record<string, ReasonChoice>;
  onChange: (code: string, choice: ReasonChoice) => void;
  onPreset: () => void;
}) {
  return (
    <div id="reasonMap">
      <p className="small">Map each code. Only Non-citizen rows go to the match. Language and Non-resident never count as non-citizen.</p>
      <p className="row">
        <button id="paPreset" type="button" className="quiet" onClick={onPreset}>{PA_PRESET_LABEL}</button>
      </p>
      <p className="small" id="paPresetNote">{PA_PRESET_NOTE}</p>
      {rows.length === 0 && <p className="small">Load or type a jury list to see its codes.</p>}
      {rows.map((row) => (
        <label key={row.value || '(blank)'} className="inline">
          <span>{row.formula ? `${row.display || '(blank)'} (formula prefix)` : (row.display || '(blank)')} ({row.count})</span>
          <select
            aria-label={`Reason for ${row.display || 'blank'}`}
            value={row.formula ? '' : (value[row.value] ?? '')}
            disabled={row.formula}
            onChange={(event) => onChange(row.value, parseChoice(event.target.value))}
          >
            <option value="">Not sent to the match</option>
            {REASON_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
      ))}
    </div>
  );
}
