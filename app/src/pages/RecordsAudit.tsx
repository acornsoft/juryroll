import { useEffect, useState } from 'react';
import { COUNTIES } from '../../../shared/src/counties.ts';
import { recordsCountsSummary, recordsRequestLetter, type RecordsCounts } from '../../../shared/src/policy/recordsAudit.ts';
import { resolveRules, type RulesFile } from '../../../shared/src/policy/gates.ts';
import { NVRA_EXEMPT_SENTENCE, RESIDENTS_ONLY_NOTE, recordsRouteFor } from '../../../shared/src/policy/recordsRoutes.ts';
import { localISO } from '../../../shared/src/policy/windows.ts';
import { STATES } from '../states.ts';
import rulesBundle from '../../../shared/src/rulesBundle.json';

type Bundle = Record<string, { raw: string; rules: RulesFile }>;
const bundle = rulesBundle as Bundle;

const EMPTY_COUNTS: RecordsCounts = {
  periodFrom: '',
  periodTo: '',
  deathRemovals: '',
  addressRemovals: '',
  inactiveRemovals: '',
  noticesSent: '',
};

const SAMPLE_COUNTS: RecordsCounts = {
  periodFrom: '2025-01-01',
  periodTo: '2025-12-31',
  deathRemovals: '12',
  addressRemovals: '34',
  inactiveRemovals: '5',
  noticesSent: '40',
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

export function RecordsAudit({ code }: { code: string | null }) {
  const [countyFips, setCountyFips] = useState('');
  const [counts, setCounts] = useState<RecordsCounts>(EMPTY_COUNTS);
  const stateCode = code && STATES.some(([item]) => item === code) ? code : '';
  const resolved = stateCode ? resolveRules(stateCode, bundle) : null;
  const rules = resolved?.rules ?? null;
  const counties = stateCode ? (COUNTIES[stateCode] ?? []) : [];
  const county = counties.find((item) => item.fips === countyFips) ?? null;
  const route = stateCode ? recordsRouteFor(stateCode) : null;
  const letter = rules && county
    ? recordsRequestLetter(rules, county.name, county.fips, counts)
    : 'Choose a state and a county. The letter will ask that county or state election office for counts only.';
  const summary = stateCode ? recordsCountsSummary(stateCode, counts) : 'Choose a state. Then enter the counts the office returns.';

  useEffect(() => {
    setCountyFips('');
  }, [stateCode]);

  function onState(next: string) {
    window.location.hash = next ? `#/records-audit/${next.toLowerCase()}` : '#/records-audit';
  }

  function setCount<K extends keyof RecordsCounts>(key: K, value: RecordsCounts[K]) {
    setCounts((current) => ({ ...current, [key]: value }));
  }

  function onDownload() {
    if (!rules || !county) return;
    downloadText(`JuryRoll-records-audit-${rules.state}-${localISO(new Date())}.txt`, letter);
  }

  return (
    <div className="page" id="records-audit">
      <div className="section-title">
        <p className="kicker">Counts only</p>
        <h2>List-maintenance records</h2>
      </div>
      <p className="lede">Ask the county or state election office for counts of list-maintenance activity. No names, and no voter file.</p>
      <div className="grid">
        <section className="panel">
          <h3>Who to ask</h3>
          <label>
            State
            <select id="recordsState" value={stateCode} onChange={(event) => onState(event.target.value)}>
              <option value="">Choose a state</option>
              {STATES.map(([item, name]) => <option key={item} value={item}>{name}</option>)}
            </select>
          </label>
          <label>
            County
            <select id="recordsCounty" value={countyFips} onChange={(event) => setCountyFips(event.target.value)} disabled={!stateCode}>
              <option value="">Choose a county</option>
              {counties.map((item) => <option key={item.fips} value={item.fips}>{item.name} ({item.fips})</option>)}
            </select>
          </label>
          <label>
            Period from
            <input id="recordsFrom" type="date" value={counts.periodFrom} onChange={(event) => setCount('periodFrom', event.target.value)} />
          </label>
          <label>
            Period to
            <input id="recordsTo" type="date" value={counts.periodTo} onChange={(event) => setCount('periodTo', event.target.value)} />
          </label>
          {route?.kind === 'nvra' && <p id="recordsRoute" className="note">Records request under 52 U.S.C. 20507(i).</p>}
          {route?.kind === 'state-public-records' && (
            <p id="recordsRoute" className="note">State public-records request. {NVRA_EXEMPT_SENTENCE} Paragraph ({route.exemptParagraph}).</p>
          )}
          {route?.residentsOnlyCite && <p id="residentsOnlyNote" className="note">{RESIDENTS_ONLY_NOTE}</p>}
          <pre id="recordsLetter">{letter}</pre>
          <p className="row no-print">
            <button id="recordsDownload" className="btn-primary" type="button" disabled={!county} onClick={onDownload}>Download the records request</button>
            <button id="recordsPrint" className="secondary" type="button" onClick={() => window.print()}>Print</button>
          </p>
        </section>
        <section className="panel" id="recordsCounts">
          <h3>Counts the office returns</h3>
          <p className="small">Type the counts from the office. The summary stays on this computer.</p>
          <label>
            Removals for death
            <input id="countDeath" type="text" inputMode="numeric" value={counts.deathRemovals} onChange={(event) => setCount('deathRemovals', event.target.value)} />
          </label>
          <label>
            Removals for change of address
            <input id="countAddress" type="text" inputMode="numeric" value={counts.addressRemovals} onChange={(event) => setCount('addressRemovals', event.target.value)} />
          </label>
          <label>
            Inactive voters removed after notice and two federal general elections
            <input id="countInactive" type="text" inputMode="numeric" value={counts.inactiveRemovals} onChange={(event) => setCount('inactiveRemovals', event.target.value)} />
          </label>
          <label>
            Notices sent
            <input id="countNotices" type="text" inputMode="numeric" value={counts.noticesSent} onChange={(event) => setCount('noticesSent', event.target.value)} />
          </label>
          <p className="row no-print">
            <button id="recordsSample" className="quiet" type="button" onClick={() => setCounts(SAMPLE_COUNTS)}>Use fictional sample counts</button>
          </p>
          <h3>Counts summary</h3>
          <pre id="recordsSummary">{summary}</pre>
        </section>
      </div>
    </div>
  );
}
