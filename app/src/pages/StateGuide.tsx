import { useMemo, useState } from 'react';
import { StepPanel, Stepper } from '../components/Stepper.tsx';
import { COUNTIES } from '../../../shared/src/counties.ts';
import { buildGuide, guideFacts } from '../lib/guide.ts';
import type { StepId } from '../lib/flow.ts';
import { NC_LIST_NOTE, PA_NAMES_ONLY_NOTE } from '../../../shared/src/content/copy.ts';
import { referralTargets, resolveRules, uiGates, type RulesFile } from '../../../shared/src/policy/gates.ts';
import { federalWindow, nextFederalElection } from '../../../shared/src/policy/windows.ts';
import { STATES } from '../states.ts';
import rulesBundle from '../../../shared/src/rulesBundle.json';

type Bundle = Record<string, { raw: string; rules: RulesFile }>;
const bundle = rulesBundle as Bundle;

function LinkedText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/);
  return (
    <>
      {parts.map((part, index) => (
        part.startsWith('http://') || part.startsWith('https://')
          ? <a key={index} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
          : <span key={index}>{part}</span>
      ))}
    </>
  );
}

function sectionId(title: string): string {
  return `guide-${title.toLowerCase().replace(/\s+/g, '-')}`;
}

function badgeFor(rules: RulesFile): 'Named leads allowed' | 'Counts-only' {
  return uiGates(rules).allow_named_export ? 'Named leads allowed' : 'Counts-only';
}

export function StateIndex({ query, onQuery }: { query: string; onQuery: (value: string) => void }) {
  const needle = query.trim().toLowerCase();
  const cards = STATES.filter(([code, name]) => {
    if (!needle) return true;
    return code.toLowerCase().includes(needle) || name.toLowerCase().includes(needle);
  });
  return (
    <div className="page" id="stateIndex">
      <div className="section-title">
        <p className="kicker">Per state</p>
        <h2>Every jurisdiction</h2>
      </div>
      <p className="lede">Every jurisdiction, from its rules file. Open one to see the federal, state, and local layers, then start a check.</p>
      <label className="search-label">
        Find a state
        <input id="stateSearch" type="search" value={query} placeholder="Type a state" autoComplete="off" onChange={(event) => onQuery(event.target.value)} />
      </label>
      <ul className="card-grid">
        {cards.map(([code, name]) => {
          const rules = bundle[code]?.rules;
          const badge = rules ? badgeFor(rules) : 'Counts-only';
          return (
            <li key={code}>
              <a className="state-card" href={`#/state/${code.toLowerCase()}`}>
                <span className={`badge ${badge === 'Named leads allowed' ? 'badge-named' : 'badge-counts'}`}>{badge}</span>
                <span className="state-card-name">{name}</span>
                <span className="state-card-code">{code}</span>
              </a>
            </li>
          );
        })}
      </ul>
      {cards.length === 0 && <p className="note">No state matches that search.</p>}
    </div>
  );
}

export function StatePage({ code }: { code: string }) {
  const [active, setActive] = useState<StepId>('where');
  const [countyFips, setCountyFips] = useState('');
  const resolved = resolveRules(code, bundle);
  const rules = resolved.rules;
  const gates = uiGates(rules);
  const election = nextFederalElection(new Date());
  const window90 = federalWindow(election);
  const counties = COUNTIES[code] ?? [];
  const county = counties.find((item) => item.fips === countyFips) ?? null;
  const sections = useMemo(
    () => buildGuide(bundle[code]?.rules ? JSON.parse(bundle[code].raw) as Record<string, unknown> : rules as unknown as Record<string, unknown>, gates, { election, start: window90.start, end: window90.end }, county?.name ?? null),
    [code, rules, gates, election, window90.start, window90.end, county?.name],
  );
  const facts = guideFacts(rules, gates);
  const targets = referralTargets(rules, bundle.DEFAULT.rules);
  const named = gates.allow_jury_list;

  const glance = sections.find((section) => section.title === 'At a glance');
  const layers = sections.filter((section) => section.title === 'Federal layer' || section.title === 'State layer' || section.title === 'Local layer');
  const startHref = `#/run/${code.toLowerCase()}`;

  return (
    <div className="page" id="walkthrough">
      <p className={`badge ${gates.allow_named_export ? 'badge-named' : 'badge-counts'}`}>
        {gates.allow_named_export ? 'Named leads allowed' : 'Counts-only'}
      </p>
      {rules.state === 'PA' && <p id="paWalkthrough">{PA_NAMES_ONLY_NOTE}</p>}
      {rules.state === 'NC' && <p id="ncWalkthrough">{NC_LIST_NOTE}</p>}
      <section className="panel" id={sectionId('Walk through it')}>
        <h2>Walk through it</h2>
        <p><a className="btn-primary" id="startCheck" href={startHref}>Start a check in {rules.name}</a></p>
        <Stepper
          facts={facts}
          activeId={active}
          mode="guide"
          onActivate={setActive}
          guideStartHref={startHref}
        >
          <StepPanel id="where">
            <p>This check is for {rules.name}. On the run you will choose one county. Referrals can go to: {targets.map((target) => target.name).join('; ') || 'the offices named in the rules file'}.</p>
          </StepPanel>
          <StepPanel id="sign">
            <p>You sign the same five statements on every state, then enter your initials. The statements are the use rules, not a substitute for the statute.</p>
          </StepPanel>
          <StepPanel id="files">
            {named ? (
              <p>Add the jury disqualification list and the voter roll, type a printed list, or try the fictional samples. Map each disqualification code. Only rows mapped to Non-citizen are matched. Column checks happen before the match runs.</p>
            ) : (
              <p>JuryRoll cannot load the jury list in {rules.name}. The rules say: {rules.gates.basis}</p>
            )}
          </StepPanel>
          <StepPanel id="run">
            <p>{named ? 'Run the match in this browser. Nothing is uploaded.' : 'There is no person match on the counts-only path.'}</p>
          </StepPanel>
          <StepPanel id="triage">
            <p>{named ? 'Strong, Probable, and Weak leads, plus the excluded and cannot-compare counts.' : 'Counts only. No names are shown.'}</p>
            {rules.state === 'PA' && <p>{PA_NAMES_ONLY_NOTE}</p>}
            {rules.state === 'NC' && <p>{NC_LIST_NOTE}</p>}
          </StepPanel>
          <StepPanel id="export">
            <p>{named ? 'Export the referral CSV. It names the county you selected.' : 'Download the counts-only letter. It names the county you selected.'}</p>
          </StepPanel>
        </Stepper>
      </section>
      {glance && (
        <section className="panel" id={sectionId(glance.title)}>
          <h2>{glance.title}</h2>
          {glance.lines.map((line, index) => <p key={`${glance.title}-${index}`}><LinkedText text={line} /></p>)}
        </section>
      )}
      {layers.map((section) => (
        <details className="guide-layer sen-acc" key={section.title} id={sectionId(section.title)}>
          <summary><i className="icon-star" aria-hidden="true" /> {section.title}</summary>
          {section.title === 'Local layer' && (
            <label>
              County
              <select id="guideCounty" value={countyFips} onChange={(event) => setCountyFips(event.target.value)}>
                <option value="">Choose a county</option>
                {counties.map((item) => <option key={item.fips} value={item.fips}>{item.name} ({item.fips})</option>)}
              </select>
            </label>
          )}
          {section.lines.map((line, index) => <p key={`${section.title}-${index}`}><LinkedText text={line} /></p>)}
        </details>
      ))}
    </div>
  );
}
