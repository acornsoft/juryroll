import { useEffect, useState } from 'react';
import { COUNTIES } from '../../../shared/src/counties.ts';
import { uiGates, resolveRules, type RulesFile } from '../../../shared/src/policy/gates.ts';
import { juryHandoffLetter, type HandoffInput } from '../../../shared/src/policy/handoffLetter.ts';
import { COUNTS_ONLY_FRAMING, handoffAvailable, handoffKind, type HandoffKind } from '../../../shared/src/policy/handoffRoutes.ts';
import { localISO } from '../../../shared/src/policy/windows.ts';
import { STATES } from '../states.ts';
import rulesBundle from '../../../shared/src/rulesBundle.json';

type Bundle = Record<string, { raw: string; rules: RulesFile }>;
const bundle = rulesBundle as Bundle;

const EMPTY: HandoffInput = {
  county: '',
  fips: '',
  periodFrom: '',
  periodTo: '',
  forwarded: '',
  noticesReceived: '',
  actionsTaken: '',
  juryCount: '',
  jurySource: '',
  removals: '',
  removalSource: '',
  reportsReceived: '',
  recordsReceived: '',
};

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function sampleFor(kind: HandoffKind): Partial<HandoffInput> {
  const period = { periodFrom: '2025-01-01', periodTo: '2025-12-31' };
  switch (kind) {
    case 'pipeline':
      return { ...period, forwarded: '3', noticesReceived: '8', actionsTaken: '2' };
    case 'audit-counts':
      return { ...period, juryCount: '4', jurySource: 'Fictional office summary', removals: '1', removalSource: 'Fictional county report' };
    case 'disqualified-reports':
      return { ...period, reportsReceived: '6', actionsTaken: '2' };
    case 'counts-only':
      return { ...period, juryCount: '4', jurySource: 'Fictional office summary', removals: '1', removalSource: 'Fictional county report', recordsReceived: '7', actionsTaken: '2' };
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

export function JuryHandoff({ code }: { code: string | null }) {
  const [countyFips, setCountyFips] = useState('');
  const [counts, setCounts] = useState<HandoffInput>(EMPTY);
  const stateCode = code && STATES.some(([item]) => item === code) ? code : '';
  const resolved = stateCode ? resolveRules(stateCode, bundle) : null;
  const rules = resolved?.rules ?? null;
  const available = rules ? handoffAvailable(uiGates(rules).allow_jury_list) : false;
  const kind = rules && available ? handoffKind(rules.state) : null;
  const counties = stateCode ? (COUNTIES[stateCode] ?? []) : [];
  const county = counties.find((item) => item.fips === countyFips) ?? null;
  const letter = rules && available && county
    ? juryHandoffLetter(rules, { ...counts, county: county.name, fips: county.fips })
    : 'Choose a state and a county. The letter goes to the election official and has counts only.';

  useEffect(() => {
    setCountyFips('');
    setCounts(EMPTY);
  }, [stateCode]);

  function onState(next: string) {
    window.location.hash = next ? `#/jury-handoff-letter/${next.toLowerCase()}` : '#/jury-handoff-letter';
  }

  function setCount<K extends keyof HandoffInput>(key: K, value: HandoffInput[K]) {
    setCounts((current) => ({ ...current, [key]: value }));
  }

  function onDownload() {
    if (!rules || !county || !available) return;
    downloadText(`JuryRoll-jury-handoff-${rules.state}-${localISO(new Date())}.txt`, letter);
  }

  return (
    <div className="page" id="jury-handoff-letter">
      <div className="section-title">
        <p className="kicker">Counts only</p>
        <h2>Jury handoff counts</h2>
      </div>
      <p className="lede">Ask the county board or the chief state election official whether jury records are forwarded, and for the counts. No names.</p>
      <section className="panel">
        <h3>Election official</h3>
        <label>
          State
          <select id="handoffState" value={stateCode} onChange={(event) => onState(event.target.value)}>
            <option value="">Choose a state</option>
            {STATES.map(([item, name]) => <option key={item} value={item}>{name}</option>)}
          </select>
        </label>
        {rules && !available && (
          <p id="handoffUnavailable" className="note">This letter is for states where JuryRoll does not load the jury list.</p>
        )}
        {available && (
          <>
            <label>
              County
              <select id="handoffCounty" value={countyFips} onChange={(event) => setCountyFips(event.target.value)}>
                <option value="">Choose a county</option>
                {counties.map((item) => <option key={item.fips} value={item.fips}>{item.name} ({item.fips})</option>)}
              </select>
            </label>
            <label>
              Period from
              <input id="handoffFrom" type="date" value={counts.periodFrom} onChange={(event) => setCount('periodFrom', event.target.value)} />
            </label>
            <label>
              Period to
              <input id="handoffTo" type="date" value={counts.periodTo} onChange={(event) => setCount('periodTo', event.target.value)} />
            </label>
            {kind && rules && <HandoffFields kind={kind} state={rules.state} counts={counts} onChange={setCount} />}
            <p className="row no-print">
              <button
                id="handoffSample"
                className="quiet"
                type="button"
                onClick={() => { if (kind) setCounts((current) => ({ ...current, ...sampleFor(kind) })); }}
              >
                Use fictional sample counts
              </button>
            </p>
          </>
        )}
        {kind && <p id="handoffKind" className="note">{kindLabel(kind)}</p>}
        {rules && COUNTS_ONLY_FRAMING[rules.state] && <p id="dcFraming" className="note">{COUNTS_ONLY_FRAMING[rules.state]}</p>}
        <pre id="handoffLetter">{letter}</pre>
        <p className="row no-print">
          <button id="handoffDownload" className="btn-primary" type="button" disabled={!available || !county} onClick={onDownload}>Download the handoff letter</button>
          <button id="handoffPrint" className="secondary" type="button" onClick={() => window.print()}>Print</button>
        </p>
      </section>
    </div>
  );
}

function kindLabel(kind: HandoffKind): string {
  switch (kind) {
    case 'pipeline':
      return 'This state has a statutory pipeline. The letter asks for counts of notices received and the resulting actions.';
    case 'audit-counts':
      return 'This state has no statutory pipeline. The letter asks for the audit counts only.';
    case 'disqualified-reports':
      return 'This letter asks only about disqualified-juror reports.';
    case 'counts-only':
      return 'This letter stays counts only.';
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

function HandoffFields({ kind, state, counts, onChange }: {
  kind: HandoffKind;
  state: string;
  counts: HandoffInput;
  onChange: <K extends keyof HandoffInput>(key: K, value: HandoffInput[K]) => void;
}) {
  switch (kind) {
    case 'pipeline':
      return (
        <>
          <label>
            Non-citizen juror excusals forwarded
            <input id="handoffForwarded" type="text" inputMode="numeric" value={counts.forwarded} onChange={(event) => onChange('forwarded', event.target.value)} />
          </label>
          <label>
            Notices received
            <input id="handoffNotices" type="text" inputMode="numeric" value={counts.noticesReceived} onChange={(event) => onChange('noticesReceived', event.target.value)} />
          </label>
          <label>
            Resulting actions
            <input id="handoffActions" type="text" inputMode="numeric" value={counts.actionsTaken} onChange={(event) => onChange('actionsTaken', event.target.value)} />
          </label>
        </>
      );
    case 'audit-counts':
      return (
        <>
          <label>
            Jurors disqualified or excused for non-citizenship
            <input id="handoffJuryCount" type="text" value={counts.juryCount} onChange={(event) => onChange('juryCount', event.target.value)} />
          </label>
          <label>
            Source of that number
            <input id="handoffJurySource" type="text" value={counts.jurySource} onChange={(event) => onChange('jurySource', event.target.value)} />
          </label>
          <label>
            Voter registrations cancelled for non-citizenship
            <input id="handoffRemovals" type="text" value={counts.removals} onChange={(event) => onChange('removals', event.target.value)} />
          </label>
          <label>
            Source of that number
            <input id="handoffRemovalSource" type="text" value={counts.removalSource} onChange={(event) => onChange('removalSource', event.target.value)} />
          </label>
        </>
      );
    case 'disqualified-reports':
      return (
        <>
          <label>
            Disqualified-juror reports received
            <input id="handoffReports" type="text" inputMode="numeric" value={counts.reportsReceived} onChange={(event) => onChange('reportsReceived', event.target.value)} />
          </label>
          <label>
            Resulting actions
            <input id="handoffActions" type="text" inputMode="numeric" value={counts.actionsTaken} onChange={(event) => onChange('actionsTaken', event.target.value)} />
          </label>
        </>
      );
    case 'counts-only':
      if (COUNTS_ONLY_FRAMING[state]) {
        return (
          <>
            <label>
              Records the election office received
              <input id="handoffRecords" type="text" inputMode="numeric" value={counts.recordsReceived} onChange={(event) => onChange('recordsReceived', event.target.value)} />
            </label>
            <label>
              Actions taken
              <input id="handoffActions" type="text" value={counts.actionsTaken} onChange={(event) => onChange('actionsTaken', event.target.value)} />
            </label>
          </>
        );
      }
      return (
        <>
          <label>
            Jurors disqualified or excused for non-citizenship
            <input id="handoffJuryCount" type="text" value={counts.juryCount} onChange={(event) => onChange('juryCount', event.target.value)} />
          </label>
          <label>
            Source of that number
            <input id="handoffJurySource" type="text" value={counts.jurySource} onChange={(event) => onChange('jurySource', event.target.value)} />
          </label>
          <label>
            Voter registrations cancelled for non-citizenship
            <input id="handoffRemovals" type="text" value={counts.removals} onChange={(event) => onChange('removals', event.target.value)} />
          </label>
          <label>
            Source of that number
            <input id="handoffRemovalSource" type="text" value={counts.removalSource} onChange={(event) => onChange('removalSource', event.target.value)} />
          </label>
        </>
      );
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}
