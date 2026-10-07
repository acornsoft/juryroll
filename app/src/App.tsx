import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import core from '../../shared/src/core.js';
import { bannerFor, HomeHero, IconBox, PageBanner, SideTab } from './components/Chrome.tsx';
import { CountySummary } from './components/CountySummary.tsx';
import { PlacePicker } from './components/PlacePicker.tsx';
import { UsMap } from './components/UsMap.tsx';
import { ReasonMap } from './components/ReasonMap.tsx';
import { StepPanel, Stepper } from './components/Stepper.tsx';
import { TranscriptionSheet } from './components/TranscriptionSheet.tsx';
import { TypeGrid } from './components/TypeGrid.tsx';
import { applyPaPreset, filterFromMap, mapFromReasons, reasonCells, tallyReasons, type ReasonChoice, type ReasonMap as ReasonMapState } from './lib/reasons.ts';
import { summaryCopy, upsertCountyRun, type CountyRun } from './lib/summary.ts';
import { blankGrid, gridToCsv } from './lib/transcribe.ts';
import { historyByVoterId } from './lib/voterContext.ts';
import { FaqPage, LawPage } from './pages/Background.tsx';
import { StateIndex, StatePage } from './pages/StateGuide.tsx';
import { stepById, type FlowFacts, type StepId } from './lib/flow.ts';
import { parseRoute } from './route.ts';
import jurorSample from '../../shared/samples/sample_juror_disqualifications.csv?raw';
import voterSample from '../../shared/samples/sample_voter_roll.csv?raw';
import jurorSampleUrl from '../../shared/samples/sample_juror_disqualifications.csv?url';
import voterSampleUrl from '../../shared/samples/sample_voter_roll.csv?url';
import jurorSampleXlsxUrl from '../../shared/samples/sample_juror_disqualifications.xlsx?url';
import voterSampleXlsxUrl from '../../shared/samples/sample_voter_roll.xlsx?url';
import jurorTemplateUrl from '../../shared/templates/juror-template.csv?url';
import voterTemplateUrl from '../../shared/templates/voter-template.csv?url';
import jurorTemplateXlsxUrl from '../../shared/templates/juror-template.xlsx?url';
import voterTemplateXlsxUrl from '../../shared/templates/voter-template.xlsx?url';
import { ATTEST_LINES, CAVEATS, NC_LIST_NOTE, PA_NAMES_ONLY_NOTE, PRIVACY_BODY, PRIVACY_LEAD, TIER_RULES, WEAK_CAUTION, APP_VERSION } from '../../shared/src/content/copy.ts';
import { analyzeText, readUpload, type AnalyzedFile } from './analyze.ts';
import { chainStatus, clearAudit, openAuditDb, readAudit, writeAudit } from './auditStore.ts';
import { COUNTIES } from '../../shared/src/counties.ts';
import { STATES } from './states.ts';
import rulesBundle from '../../shared/src/rulesBundle.json';
import { appendEntry, auditLogFile, userAgentFamily, type AuditEntry, type AuditType } from '../../shared/src/policy/audit.ts';
import type { ExtraColumns } from '../../shared/src/policy/columns.ts';
import { exportableRows, flagLabel, type PolicyResult, type PolicyRow } from '../../shared/src/policy/apply.ts';
import { referralFileName, toCSV } from '../../shared/src/policy/exportCsv.ts';
import { ND_REGISTRATION_NOTE, NON_SIGNAL, NON_SIGNAL_LABEL, referralTargets, resolveRules, strict, uiGates, useLimitApplies, type ResolvedRules, type RulesFile } from '../../shared/src/policy/gates.ts';
import { auditLetter } from '../../shared/src/policy/letter.ts';
import { runMatch } from '../../shared/src/policy/runMatch.ts';
import { sha256Hex, sha256HexSync } from '../../shared/src/policy/sha256.ts';
import { addDays, federalWindow, inRange, localISO, nextFederalElection, stateWindowDates } from '../../shared/src/policy/windows.ts';
import type { MatchResult } from '../../shared/src/core.js';

type Bundle = Record<string, { raw: string; rules: RulesFile }>;
const bundle = rulesBundle as Bundle;

type Reason = { value: string; count: number; auto: boolean };
type Held = AnalyzedFile & {
  hasHeader: boolean;
  order: string;
  reasons: Reason[];
  reasonFilter: Record<string, boolean>;
};
type Kind = 'juror' | 'voter';
type PendingBook = { sha256: string; bytes: number; names: string[]; csvBySheet: Record<string, string> };
type PurgeTrigger = 'button' | 'after_export' | 'timeout' | 'pagehide';
type DateField = 'declDate' | 'regDate';

const ATTEST_REFUSE = 'Sign the use statement and enter your initials before you load a file or run the match.';

function rowDestination(section: PolicyRow['section']): 'named' | 'weak' | 'removed' | 'hidden' {
  switch (section) {
    case 'main':
      return 'named';
    case 'weak':
      return 'weak';
    case 'already-removed':
      return 'removed';
    case 'excluded':
      return 'hidden';
    default: {
      const neverSection: never = section;
      return neverSection;
    }
  }
}

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function attestationText(): string {
  return ATTEST_LINES.join('\n');
}

export function App() {
  const [code, setCode] = useState('');
  const [resolved, setResolved] = useState<ResolvedRules | null>(null);
  const [checks, setChecks] = useState([false, false, false, false, false]);
  const [initials, setInitials] = useState('');
  const [election, setElection] = useState(() => nextFederalElection(new Date()));
  const [countyFips, setCountyFips] = useState('');
  const [juror, setJuror] = useState<Held | null>(null);
  const [voter, setVoter] = useState<Held | null>(null);
  const [pendingJ, setPendingJ] = useState<PendingBook | null>(null);
  const [pendingV, setPendingV] = useState<PendingBook | null>(null);
  const [hdrJ, setHdrJ] = useState(true);
  const [hdrV, setHdrV] = useState(true);
  const [fileError, setFileError] = useState('');
  const [policy, setPolicy] = useState<PolicyResult | null>(null);
  const [coreResult, setCoreResult] = useState<MatchResult | null>(null);
  const [showWeak, setShowWeak] = useState(false);
  const [modal, setModal] = useState(false);
  const [idleWarn, setIdleWarn] = useState(false);
  const [memWarn, setMemWarn] = useState(false);
  const [integrity, setIntegrity] = useState('');
  const [includeIds, setIncludeIds] = useState(false);
  const [logCount, setLogCount] = useState(0);
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [juryCount, setJuryCount] = useState('');
  const [jurySource, setJurySource] = useState('');
  const [removals, setRemovals] = useState('');
  const [removalSource, setRemovalSource] = useState('');
  const [clearedNote, setClearedNote] = useState('');
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  const [activeStep, setActiveStep] = useState<StepId>('where');
  const [invalidateNote, setInvalidateNote] = useState('');
  const [stateQuery, setStateQuery] = useState('');
  const [typedRows, setTypedRows] = useState<string[][]>(() => blankGrid());
  const [reasonMap, setReasonMap] = useState<ReasonMapState>({});
  const [rollup, setRollup] = useState<CountyRun[]>([]);
  const [copyNote, setCopyNote] = useState('');

  const logRef = useRef<AuditEntry[]>([]);
  const idbRef = useRef<IDBDatabase | null>(null);
  const memOnly = useRef(false);
  const started = useRef(false);
  const signed = useRef(false);
  const jurorRef = useRef<Held | null>(null);
  const voterRef = useRef<Held | null>(null);
  const policyRef = useRef<PolicyResult | null>(null);
  const appliedPreset = useRef('');
  const paPresetRef = useRef(false);
  const reasonMapRef = useRef<ReasonMapState>({});
  const exportTimer = useRef(0);
  const warnTimer = useRef(0);
  const idleTimer = useRef(0);
  const appendRef = useRef<(type: AuditType, data: Record<string, unknown>) => Promise<void>>(async () => {});
  const purgeRef = useRef<(trigger: PurgeTrigger) => void>(() => {});

  jurorRef.current = juror;
  voterRef.current = voter;
  policyRef.current = policy;
  reasonMapRef.current = reasonMap;

  async function append(type: AuditType, data: Record<string, unknown>) {
    const next = appendEntry(logRef.current, type, data);
    logRef.current = next;
    setLogCount(next.length);
    const entry = next[next.length - 1];
    if (!idbRef.current || memOnly.current) return;
    try {
      await writeAudit(idbRef.current, entry);
    } catch {
      memOnly.current = true;
      setMemWarn(true);
    }
  }
  appendRef.current = append;

  function clearLoaded() {
    jurorRef.current = null;
    voterRef.current = null;
    policyRef.current = null;
    setJuror(null);
    setVoter(null);
    setPendingJ(null);
    setPendingV(null);
    setPolicy(null);
    setCoreResult(null);
    setShowWeak(false);
    setFileError('');
    setTypedRows(blankGrid());
    setReasonMap({});
    setRollup([]);
    setCopyNote('');
    paPresetRef.current = false;
    document.body.dataset.purged = '1';
    delete document.body.dataset.hasFiles;
  }

  function purge(trigger: PurgeTrigger) {
    const had = Boolean(jurorRef.current || voterRef.current || policyRef.current);
    if (!had && trigger !== 'button') return;
    clearLoaded();
    const jurorInput = document.getElementById('fileJuror');
    const voterInput = document.getElementById('fileVoter');
    if (jurorInput instanceof HTMLInputElement) jurorInput.value = '';
    if (voterInput instanceof HTMLInputElement) voterInput.value = '';
    setModal(false);
    window.clearTimeout(exportTimer.current);
    const clearsLog = trigger === 'button' || trigger === 'after_export' || trigger === 'timeout';
    if (!clearsLog) {
      void appendRef.current('purge', { trigger });
      return;
    }
    logRef.current = [];
    setLogCount(0);
    setIntegrity('');
    delete document.body.dataset.logCleared;
    const db = idbRef.current;
    if (!db || memOnly.current) {
      document.body.dataset.logCleared = '1';
      return;
    }
    void clearAudit(db).then(() => {
      document.body.dataset.logCleared = '1';
    }).catch(() => {
      memOnly.current = true;
      setMemWarn(true);
    });
  }
  purgeRef.current = purge;

  useEffect(() => {
    let gone = false;
    void (async () => {
      try {
        const db = await openAuditDb();
        if (gone) {
          db.close();
          return;
        }
        const stored = await readAudit(db);
        if (gone) return;
        idbRef.current = db;
        // A state choice can append session_start before IndexedDB opens.
        // Those entries exist only in memory. Adopting the database snapshot
        // would drop them, so keep the memory chain when it already covers
        // everything that was stored and write back whatever the snapshot missed.
        const pending = logRef.current;
        const pendingHashes = new Set(pending.map((entry) => entry.hash));
        const storedIsSubset = stored.every((entry) => pendingHashes.has(entry.hash));
        if (pending.length > 0 && storedIsSubset) {
          for (const entry of pending) {
            if (!stored.some((item) => item.hash === entry.hash)) await writeAudit(db, entry);
          }
        } else {
          logRef.current = stored;
        }
        if (gone) return;
        const entries = logRef.current;
        setLogCount(entries.length);
        const check = chainStatus(entries);
        if (!check.ok) {
          setIntegrity(`Audit log integrity check failed at entry ${check.seq}`);
          const already = entries.some((entry) => entry.type === 'log_chain_break' && entry.data.failed_seq === check.seq);
          if (!already) await appendRef.current('log_chain_break', { failed_seq: check.seq });
        } else if (entries.length) {
          setIntegrity('Audit log verified.');
        }
      } catch {
        memOnly.current = true;
        setMemWarn(true);
      }
    })();
    const arm = () => {
      window.clearTimeout(warnTimer.current);
      window.clearTimeout(idleTimer.current);
      warnTimer.current = window.setTimeout(() => setIdleWarn(true), 28 * 60 * 1000);
      idleTimer.current = window.setTimeout(() => purgeRef.current('timeout'), 30 * 60 * 1000);
    };
    const onAct = () => {
      setIdleWarn(false);
      arm();
    };
    arm();
    window.addEventListener('pointerdown', onAct);
    window.addEventListener('keydown', onAct);
    const onHide = () => purgeRef.current('pagehide');
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);
    return () => {
      gone = true;
      window.removeEventListener('pointerdown', onAct);
      window.removeEventListener('keydown', onAct);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
      window.clearTimeout(warnTimer.current);
      window.clearTimeout(idleTimer.current);
    };
  }, []);

  useEffect(() => {
    if (modal) document.getElementById('purgeNow')?.focus();
  }, [modal]);

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const rules = resolved?.rules ?? null;
  const gates = rules ? uiGates(rules) : null;
  const attested = checks.every(Boolean) && initials.trim().length >= 1;
  const ready = Boolean(code) && attested;
  const today = localISO(new Date());
  const window90 = federalWindow(election);
  const inFederal = inRange(today, window90.start, window90.end);
  const stateName = STATES.find((item) => item[0] === code)?.[1] ?? code;
  const targets = rules ? referralTargets(rules, bundle.DEFAULT.rules) : [];
  const deadlineDays = rules?.private_challenge.deadline_days_before_election;
  const deadlineDate = typeof deadlineDays === 'number' ? addDays(election, -deadlineDays) : null;
  const deadlinePassed = Boolean(deadlineDate && today > deadlineDate);
  const windows = rules ? stateWindowDates(election, rules.blackout.state_windows, today) : [];
  const stateCounties = code ? (COUNTIES[code] ?? []) : [];
  const selectedCounty = stateCounties.find((item) => item.fips === countyFips) ?? null;

  useEffect(() => {
    if (route.name !== 'home' || !route.preset) return;
    if (appliedPreset.current === route.preset) return;
    appliedPreset.current = route.preset;
    if (code === route.preset) return;
    void onState(route.preset);
  }, [route, code]);

  useEffect(() => {
    if (attested || !policyRef.current) return;
    setPolicy(null);
    setCoreResult(null);
    setInvalidateNote('The use statement changed. The match was cleared and has to be run again.');
  }, [attested]);
  useEffect(() => {
    if (!gates) {
      delete document.body.dataset.aggregate;
      return;
    }
    document.body.dataset.aggregate = gates.allow_named_export ? '0' : '1';
  }, [gates]);

  async function onState(next: string) {
    const hadJuror = Boolean(jurorRef.current);
    const hadResult = Boolean(policyRef.current);
    setCode(next);
    setInvalidateNote(hadResult ? 'The state changed. The match was cleared and has to be run again.' : '');
    setCountyFips('');
    setPolicy(null);
    setCoreResult(null);
    if (!next) {
      setResolved(null);
      setClearedNote('');
      return;
    }
    const picked = resolveRules(next, bundle);
    setResolved(picked);
    const nextAllows = Boolean(picked.rules && uiGates(picked.rules).allow_jury_list);
    if (nextAllows) {
      setClearedNote('');
    } else {
      if (hadJuror) {
        const nextName = STATES.find((item) => item[0] === next)?.[1] ?? next;
        const basis = picked.rules?.gates.basis ?? '';
        setClearedNote(`The loaded jury file was cleared because ${nextName} does not allow JuryRoll to hold the jury list. ${basis}`);
      } else {
        setClearedNote('');
      }
      setJuror(null);
      setPendingJ(null);
      setTypedRows(blankGrid());
      jurorRef.current = null;
    }
    if (!started.current) {
      started.current = true;
      await append('session_start', { state: next, browser: userAgentFamily(navigator.userAgent) });
    }
    const sourceKey = picked.fallback ? 'DEFAULT' : next;
    await append('rules_loaded', {
      state: next,
      schema_version: picked.rules.schema_version,
      verified_on: picked.rules.verified_on,
      sha256: sha256HexSync(bundle[sourceKey].raw),
      fallback_to_default: picked.fallback,
    });
  }

  function onCounty(fips: string) {
    if (fips === countyFips) return;
    const hadResult = Boolean(policyRef.current);
    setCountyFips(fips);
    if (!hadResult) {
      setInvalidateNote('');
      return;
    }
    setPolicy(null);
    setCoreResult(null);
    setShowWeak(false);
    setInvalidateNote('The county changed. The match was cleared and has to be run again.');
    setActiveStep('where');
  }

  function markAttestation(nextChecks: boolean[], nextInitials: string) {
    const complete = nextChecks.every(Boolean) && nextInitials.trim().length >= 1;
    if (!complete || signed.current) return;
    signed.current = true;
    void append('attestation_signed', {
      text_sha256: sha256HexSync(attestationText()),
      initials_sha256: sha256HexSync(nextInitials.trim()),
    });
  }

  async function acceptText(kind: Kind, text: string, bytes: number, sha256: string, hasHeader: boolean) {
    if (!attested) {
      setFileError(ATTEST_REFUSE);
      return;
    }
    if (!gates?.allow_jury_list) {
      setFileError(rules?.gates.basis || confidential || 'JuryRoll does not load a jury list for this state.');
      return;
    }
    const analyzed = analyzeText(text, hasHeader, kind, bytes, sha256);
    if (!analyzed.ok) {
      if (kind === 'juror') setJuror(null);
      else setVoter(null);
      setFileError(`JuryRoll refused this file. Blocked column: ${analyzed.headers.join(', ')}.`);
      await append('file_refused', { kind, reason: 'blocked_header', headers: analyzed.headers });
      return;
    }
    setFileError('');
    const reasons = kind === 'juror' && analyzed.file.map.reason >= 0
      ? core.reasonValues(analyzed.file.text, analyzed.file.delim, hasHeader, analyzed.file.map.reason)
      : [];
    const nextMap = paPresetRef.current ? applyPaPreset(mapFromReasons(reasons)) : mapFromReasons(reasons);
    if (kind === 'juror') setReasonMap(nextMap);
    const held: Held = {
      ...analyzed.file,
      hasHeader,
      order: 'MDY',
      reasons,
      reasonFilter: kind === 'juror' ? filterFromMap(nextMap) : {},
    };
    if (kind === 'juror') setJuror(held);
    else setVoter(held);
    document.body.dataset.hasFiles = '1';
    delete document.body.dataset.purged;
    await append('file_loaded', { kind, sha256, bytes, rows: analyzed.file.rows, headers: analyzed.file.headers });
  }

  async function takeFile(kind: Kind, file: File) {
    if (!attested) {
      setFileError(ATTEST_REFUSE);
      const input = document.getElementById(kind === 'juror' ? 'fileJuror' : 'fileVoter');
      if (input instanceof HTMLInputElement) input.value = '';
      return;
    }
    if (!gates?.allow_jury_list) {
      setFileError(rules?.gates.basis || confidential || 'JuryRoll does not load a jury list for this state.');
      return;
    }
    const upload = await readUpload(file);
    const hasHeader = kind === 'juror' ? hdrJ : hdrV;
    if (upload.book && upload.book.names.length > 1) {
      const pending = { sha256: upload.sha256, bytes: upload.bytes, names: upload.book.names, csvBySheet: upload.book.csvBySheet };
      if (kind === 'juror') setPendingJ(pending);
      else setPendingV(pending);
      return;
    }
    if (kind === 'juror') setPendingJ(null);
    else setPendingV(null);
    await acceptText(kind, upload.text ?? '', upload.bytes, upload.sha256, hasHeader);
  }

  function onJurorDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!gates?.allow_jury_list) {
      setFileError(confidential);
      void append('file_refused', { kind: 'juror', reason: 'jury_gate', headers: [] });
      return;
    }
    if (!attested) {
      setFileError(ATTEST_REFUSE);
      return;
    }
    const file = event.dataTransfer.files[0];
    if (file) void takeFile('juror', file);
  }

  async function loadSamples() {
    if (!attested) {
      setFileError(ATTEST_REFUSE);
      return;
    }
    if (!rules || !gates?.allow_jury_list) {
      setFileError(rules?.gates.basis || 'Choose a state that allows the jury list before loading sample data.');
      return;
    }
    const jurorBytes = new TextEncoder().encode(jurorSample);
    const voterBytes = new TextEncoder().encode(voterSample);
    await acceptText('juror', jurorSample, jurorBytes.byteLength, await sha256Hex(jurorBytes), true);
    await acceptText('voter', voterSample, voterBytes.byteLength, await sha256Hex(voterBytes), true);
  }

  function patch(kind: Kind, update: (held: Held) => Held) {
    if (kind === 'juror') setJuror((held) => (held ? update(held) : held));
    else setVoter((held) => (held ? update(held) : held));
  }

  async function commitTyped() {
    const csv = gridToCsv(typedRows);
    if (csv.trim().split('\n').length < 2) {
      setFileError('Type at least one juror row before using the list.');
      return;
    }
    const bytes = new TextEncoder().encode(csv);
    await acceptText('juror', csv, bytes.byteLength, await sha256Hex(bytes), true);
  }

  function printBlankSheet() {
    document.body.dataset.printSheet = '1';
    window.addEventListener('afterprint', () => { delete document.body.dataset.printSheet; }, { once: true });
    window.print();
  }

  function onReasonCategory(code: string, choice: ReasonChoice) {
    const next = { ...reasonMap, [code]: choice };
    setReasonMap(next);
    setJuror((held) => (held ? { ...held, reasonFilter: filterFromMap(next) } : held));
  }

  function onPaPreset() {
    paPresetRef.current = true;
    const next = applyPaPreset(reasonMap);
    setReasonMap(next);
    setJuror((held) => (held ? { ...held, reasonFilter: filterFromMap(next) } : held));
  }

  async function onCopySummary() {
    const text = summaryCopy(rollup);
    try {
      await navigator.clipboard.writeText(text);
      setCopyNote('Copied on this computer.');
    } catch {
      setCopyNote(text);
    }
  }

  async function onRun() {
    if (!attested) {
      setFileError(ATTEST_REFUSE);
      return;
    }
    if (!gates?.allow_jury_list) {
      setFileError(rules?.gates.basis || confidential || 'JuryRoll does not run a match for this state.');
      return;
    }
    if (!selectedCounty) return;
    if (!juror || !voter || !rules || !selectedCounty) return;
    const activeMap = reasonMapRef.current;
    const matched = runMatch(
      {
        text: juror.text,
        delim: juror.delim,
        hasHeader: juror.hasHeader,
        headers: juror.headers,
        map: juror.map,
        extra: juror.extra,
        order: juror.order,
        reasonFilter: filterFromMap(activeMap),
      },
      {
        text: voter.text,
        delim: voter.delim,
        hasHeader: voter.hasHeader,
        headers: voter.headers,
        map: voter.map,
        extra: voter.extra,
        order: voter.order,
        reasonFilter: null,
      },
      rules,
    );
    setCoreResult(matched.coreResult);
    setPolicy(matched.policy);
    setInvalidateNote('');
    setActiveStep('triage');
    const cells = reasonCells(juror.text, juror.delim, juror.hasHeader, juror.map.reason ?? -1, juror.rows);
    const tallies = tallyReasons(cells, activeMap);
    setRollup((rows) => upsertCountyRun(rows, {
      stateCode: code,
      stateName,
      countyName: selectedCounty.name,
      countyFips: selectedCounty.fips,
      entered: tallies.entered,
      nonCitizen: tallies.nonCitizen,
      language: tallies.language,
      nonResident: tallies.nonResident,
      strong: matched.policy.counts.Strong,
      probable: matched.policy.counts.Probable,
      weak: matched.policy.counts.Weak,
      excluded: matched.policy.excludedAfterCount,
      cannotCompare: matched.policy.cannotCompareCount,
    }));
    const mapping: Record<string, string> = {};
    const add = (prefix: string, held: Held, fields: string[]) => {
      fields.forEach((field) => {
        const index = held.map[field];
        if (index >= 0) mapping[`${prefix}.${field}`] = held.headers[index];
      });
    };
    add('juror', juror, core.JUROR_FIELDS);
    add('voter', voter, core.VOTER_FIELDS);
    await append('mapping_set', mapping);
    await append('match_run', {
      counts: matched.policy.counts,
      flag_counts: matched.policy.flagCounts,
      cap_applied: matched.policy.capApplied,
      excluded_registered_after: matched.policy.excludedAfterCount,
      cannot_compare_no_reg_date: matched.policy.cannotCompareCount,
      county_name: selectedCounty.name,
      county_fips: selectedCounty.fips,
    });
  }

  async function onExport() {
    if (!policy || !rules || !gates?.allow_named_export || !selectedCounty) return;
    const dateStr = localISO(new Date());
    const csv = toCSV({
      allowNamedExport: true,
      result: policy,
      rules,
      targets,
      county: selectedCounty.name,
      fips: selectedCounty.fips,
      dateStr,
    });
    downloadText(referralFileName(rules.state, selectedCounty.name, dateStr), csv, 'text/csv;charset=utf-8');
    const { main, removed } = exportableRows(policy);
    const tiers = { Strong: 0, Probable: 0, Weak: 0 };
    [...main, ...removed].forEach((row) => { tiers[row.tier] += 1; });
    const data: Record<string, unknown> = {
      rows: main.length + removed.length,
      tiers,
      sha256: await sha256Hex(csv),
      county_name: selectedCounty.name,
      county_fips: selectedCounty.fips,
    };
    if (includeIds) data.voter_ids = [...main, ...removed].map((row) => row.voterId);
    await append('export', data);
    setModal(true);
    window.clearTimeout(exportTimer.current);
    exportTimer.current = window.setTimeout(() => purgeRef.current('after_export'), 10 * 60 * 1000);
  }

  function letterText(): string {
    if (!rules || !selectedCounty) return 'Choose a county before you export. The letter will name that county.';
    return auditLetter(rules, targets, {
      periodFrom,
      periodTo,
      juryCount,
      jurySource,
      removals,
      removalSource,
      county: selectedCounty.name,
      fips: selectedCounty.fips,
    });
  }

  async function onLetter() {
    if (!rules || !selectedCounty) return;
    const text = letterText();
    downloadText(`JuryRoll-audit-${code || 'state'}-${localISO(new Date())}.txt`, text, 'text/plain');
    await append('audit_letter_exported', {
      jury_count: juryCount,
      removals,
      period_from: periodFrom,
      period_to: periodTo,
      county_name: selectedCounty.name,
      county_fips: selectedCounty.fips,
    });
  }

  function onDownloadLog() {
    const text = auditLogFile(
      logRef.current,
      selectedCounty ? { name: selectedCounty.name, fips: selectedCounty.fips } : null,
    );
    downloadText(`juryroll-audit-${localISO(new Date())}.jsonl`, text, 'application/jsonl');
  }

  const canRun = Boolean(
    ready && selectedCounty && juror && voter
    && juror.map.last >= 0 && juror.map.first >= 0
    && voter.map.last >= 0 && voter.map.first >= 0,
  );
  const confidential = rules
    ? `The jury list is confidential in ${stateName}${rules.jury_list.statute ? ` (${rules.jury_list.statute})` : ''}. JuryRoll does not load it.`
    : '';
  const named = Boolean(gates?.allow_named_export && policy);
  const mainRows = named ? policy!.rows.filter((row) => rowDestination(row.section) === 'named') : [];
  const weakRows = named ? policy!.rows.filter((row) => rowDestination(row.section) === 'weak') : [];
  const removedRows = named ? policy!.rows.filter((row) => rowDestination(row.section) === 'removed') : [];
  const columnNote = [juror?.note, voter?.note].filter(Boolean).join(' ');
  const voterHistory = voter
    ? historyByVoterId(voter.text, voter.delim, voter.hasHeader, voter.headers, voter.map.voter_id ?? -1)
    : {};
  const reasonRows = (() => {
    const seen = new Map<string, number>();
    for (const reason of juror?.reasons ?? []) seen.set(reason.value, reason.count);
    for (const code of Object.keys(reasonMap)) {
      if (!seen.has(code)) seen.set(code, 0);
    }
    return [...seen.entries()].map(([value, count]) => ({ value, count }));
  })();
  const facts: FlowFacts = {
    stateCode: code,
    stateName,
    countyName: selectedCounty?.name ?? '',
    countyFips,
    attested,
    allowJuryList: Boolean(gates?.allow_jury_list),
    blockReason: rules?.gates.basis ?? '',
    jurorLoaded: Boolean(juror),
    voterLoaded: Boolean(voter),
    hasResult: Boolean(policy),
    namedExport: Boolean(gates?.allow_named_export),
  };
  const nextEnabled = stepById(activeStep).complete(facts) && !stepById(activeStep).blocked(facts);
  const section = route.name === 'state' ? 'states' : route.name;
  const bannerState = route.name === 'state'
    ? (STATES.find((item) => item[0] === route.code)?.[1] ?? route.code)
    : '';
  const banner = bannerFor(route, bannerState);
  const runHref = section === 'home' ? '#stepper' : '#/run';

  let page: ReactNode;
  switch (route.name) {
    case 'states':
      page = <StateIndex query={stateQuery} onQuery={setStateQuery} />;
      break;
    case 'state':
      page = <StatePage code={route.code} />;
      break;
    case 'law':
      page = <LawPage topic={route.topic} />;
      break;
    case 'faq':
      page = <FaqPage />;
      break;
    case 'home':
      page = (
        <>
          {idleWarn && <p className="warn" id="idleWarn" role="status">No activity for 28 minutes. JuryRoll will purge the loaded data and the audit log at 30 minutes. Download the log first if you need it.</p>}
          {resolved?.reason && <p className="banner" id="rulesFallback" role="status">{resolved.reason}</p>}
          {fileError && <p className="banner" id="fileError" role="alert">{fileError}</p>}

          <Stepper
            facts={facts}
            activeId={activeStep}
            notice={invalidateNote}
            nextEnabled={nextEnabled}
            onActivate={setActiveStep}
            companion={(
              <UsMap
                stateCode={code}
                countyFips={countyFips}
                counties={stateCounties}
                onState={(next) => { void onState(next); }}
                onCounty={onCounty}
              />
            )}
          >
            <StepPanel id="where">
              <section id="step0">
                <PlacePicker
                  stateCode={code}
                  countyFips={countyFips}
                  counties={stateCounties}
                  onState={(next) => { void onState(next); }}
                  onCounty={onCounty}
                />
                <label>
                  Federal election date
                  <input id="electionDate" type="date" value={election} onChange={(event) => setElection(event.target.value)} />
                </label>
                <p className="small">The date sets the federal window. <a className="why" href="#/law/blackout">Why?</a></p>
                {rules && rules.blackout.state_extra_days === null && <p className="note" id="stateLimits">State time limits not verified</p>}
                {rules && (
                  <ul className="small" id="rulesNotes">
                    {rules.notes.map((note) => <li key={note}>{note}</li>)}
                  </ul>
                )}
                {windows.length > 0 && (
                  <ul className="small" id="stateWindows">
                    {windows.map((item) => (
                      <li key={item.statute}>{item.label}: {item.effect} ({item.statute}) Date: {item.date}.{item.passed ? ' Passed.' : ''}</li>
                    ))}
                  </ul>
                )}
              </section>
            </StepPanel>
            <StepPanel id="sign">
              {rules?.voter_file.permitted_uses && <p className="small" id="permittedUses">{rules.voter_file.permitted_uses}</p>}
              {ATTEST_LINES.map((line, index) => (
                <label className="inline" key={line}>
                  <input
                    id={`attest${index + 1}`}
                    type="checkbox"
                    checked={checks[index]}
                    onChange={(event) => {
                      const next = checks.slice();
                      next[index] = event.target.checked;
                      setChecks(next);
                      markAttestation(next, initials);
                    }}
                  />
                  <span>{line}</span>
                </label>
              ))}
              <label>
                Initials
                <input
                  id="initials"
                  type="text"
                  value={initials}
                  autoComplete="off"
                  onChange={(event) => {
                    setInitials(event.target.value);
                    markAttestation(checks, event.target.value);
                  }}
                />
              </label>
              <p className="small">The five statements are the use rules. <a className="why" href="#/law/use">Why?</a></p>
            </StepPanel>
            <StepPanel id="files">
              {code && gates && !gates.allow_jury_list && rules && (
                <section className="panel" id="auditMode">
                  <h3>Counts only</h3>
                  <p className="banner" id="juryBlocked">{confidential}</p>
                  {clearedNote && <p className="banner" id="jurorCleared" role="status">{clearedNote}</p>}
                  <p className="banner" id="juryRefuse">JuryRoll cannot load the jury list or run a match in {stateName}. The rules say: {rules.gates.basis}</p>
                  <div id="jurorSlot" onDragOver={(event) => event.preventDefault()} onDrop={onJurorDrop}>
                    <p>No person file is loaded. Dropping a jury list here does nothing.</p>
                  </div>
                  <div className="grid" id="auditPeriod">
                    <label>Period from<input id="auditFrom" type="date" value={periodFrom} onChange={(event) => setPeriodFrom(event.target.value)} /></label>
                    <label>Period to<input id="auditTo" type="date" value={periodTo} onChange={(event) => setPeriodTo(event.target.value)} /></label>
                  </div>
                  <label>Jurors disqualified or excused for non-citizenship<input id="auditJuryCount" type="text" value={juryCount} onChange={(event) => setJuryCount(event.target.value)} /></label>
                  <label>Source of that number<input id="auditJurySource" type="text" value={jurySource} onChange={(event) => setJurySource(event.target.value)} /></label>
                  <label>Voter registrations cancelled for non-citizenship<input id="auditRemovals" type="text" value={removals} onChange={(event) => setRemovals(event.target.value)} /></label>
                  <label>Source of that number<input id="auditRemovalSource" type="text" value={removalSource} onChange={(event) => setRemovalSource(event.target.value)} /></label>
                  <pre id="auditLetter">{letterText()}</pre>
                  <p className="row no-print"><button id="auditLetterBtn" className="btn-primary" type="button" disabled={!selectedCounty} onClick={() => { void onLetter(); }}>Download the audit letter</button></p>
                </section>
              )}
              {gates?.allow_jury_list && (
                <fieldset className="panel" id="step1" disabled={!ready}>
                  <legend>Jury list and voter roll</legend>
                  <p className="small">Blank templates and fictional samples stay on this page, under the steps.</p>
                  <div className="grid">
                    <div id="jurorSlot" onDragOver={(event) => event.preventDefault()} onDrop={onJurorDrop}>
                      <h3>Jury disqualifications</h3>
                      <input id="fileJuror" type="file" accept=".csv,.txt,.tsv,.xlsx,.xls,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void takeFile('juror', file); }} />
                      <label className="inline"><input id="hdrJuror" type="checkbox" checked={hdrJ} onChange={(event) => { setHdrJ(event.target.checked); if (juror) void acceptText('juror', juror.text, juror.bytes, juror.sha256, event.target.checked); }} /> First row has column names</label>
                      {pendingJ && (
                        <label>Choose a sheet
                          <select id="jurorSheet" defaultValue="" onChange={(event) => { const name = event.target.value; if (!name || !pendingJ) return; void acceptText('juror', pendingJ.csvBySheet[name], pendingJ.bytes, pendingJ.sha256, hdrJ); setPendingJ(null); }}>
                            <option value="">Choose a sheet</option>
                            {pendingJ.names.map((name) => <option key={name} value={name}>{name}</option>)}
                          </select>
                        </label>
                      )}
                      {juror && <p className="small" id="infoJuror">{juror.rows} rows. {juror.sheetName ?? 'Table loaded.'}</p>}
                    </div>
                    <div id="voterSlot">
                      <h3>Voter file</h3>
                      <input id="fileVoter" type="file" accept=".csv,.txt,.tsv,.xlsx,.xls,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void takeFile('voter', file); }} />
                      <label className="inline"><input id="hdrVoter" type="checkbox" checked={hdrV} onChange={(event) => { setHdrV(event.target.checked); if (voter) void acceptText('voter', voter.text, voter.bytes, voter.sha256, event.target.checked); }} /> First row has column names</label>
                      {pendingV && (
                        <label>Choose a sheet
                          <select id="voterSheet" defaultValue="" onChange={(event) => { const name = event.target.value; if (!name || !pendingV) return; void acceptText('voter', pendingV.csvBySheet[name], pendingV.bytes, pendingV.sha256, hdrV); setPendingV(null); }}>
                            <option value="">Choose a sheet</option>
                            {pendingV.names.map((name) => <option key={name} value={name}>{name}</option>)}
                          </select>
                        </label>
                      )}
                      {voter && <p className="small" id="infoVoter">{voter.rows} rows.</p>}
                    </div>
                  </div>
                  <p className="row">
                    <button id="sampleBtn" type="button" className="secondary" onClick={() => { void loadSamples(); }}>Try with sample data</button>
                    {(juror || voter) && <span className="small" id="purgeLogNote">Purge also deletes the audit log. Download the log first.</span>}
                  </p>
                  {columnNote && <p className="note" id="columnNote">{columnNote}</p>}
                  <div id="typePath">
                    <h3>Type it in</h3>
                    <p className="small">For a printed non-juror list. Enter moves to the next row. Paste from a spreadsheet. Rows stay in memory on this computer and are cleared by Purge.</p>
                    <TypeGrid rows={typedRows} onChange={setTypedRows} />
                    <p className="row">
                      <button id="useTypedBtn" type="button" className="secondary" onClick={() => { void commitTyped(); }}>Use typed list</button>
                      <button id="printSheetBtn" type="button" className="quiet" onClick={printBlankSheet}>Print blank transcription sheet</button>
                    </p>
                  </div>
                </fieldset>
              )}
              {!code && <p className="small">Choose a state first. This step opens after you sign, or it becomes the counts-only branch.</p>}
            </StepPanel>
            <StepPanel id="run">
              {gates?.allow_jury_list ? (
                <>
                  <fieldset className="panel" id="step2" disabled={!ready}>
                    <legend>Check columns</legend>
                    <div className="grid">
                      <div>
                        <h3>Jury columns</h3>
                        <label className="inline">Dates with slashes
                          <select id="orderJuror" value={juror?.order ?? 'MDY'} onChange={(event) => patch('juror', (held) => ({ ...held, order: event.target.value }))}>
                            <option value="MDY">MM/DD/YYYY (US)</option>
                            <option value="DMY">DD/MM/YYYY</option>
                          </select>
                        </label>
                        {juror && (
                          <MapTable
                            id="mapJuror"
                            headers={juror.headers}
                            map={juror.map}
                            fields={core.JUROR_FIELDS}
                            extra={juror.extra}
                            onChange={(field, index) => patch('juror', (held) => ({ ...held, map: { ...held.map, [field]: index } }))}
                            onExtra={(field, index) => patch('juror', (held) => ({ ...held, extra: { ...held.extra, [field]: index } }))}
                          />
                        )}
                      </div>
                      <div>
                        <h3>Voter columns</h3>
                        <label className="inline">Dates with slashes
                          <select id="orderVoter" value={voter?.order ?? 'MDY'} onChange={(event) => patch('voter', (held) => ({ ...held, order: event.target.value }))}>
                            <option value="MDY">MM/DD/YYYY (US)</option>
                            <option value="DMY">DD/MM/YYYY</option>
                          </select>
                        </label>
                        {voter && (
                          <MapTable
                            id="mapVoter"
                            headers={voter.headers}
                            map={voter.map}
                            fields={core.VOTER_FIELDS}
                            extra={voter.extra}
                            onChange={(field, index) => patch('voter', (held) => ({ ...held, map: { ...held.map, [field]: index } }))}
                            onExtra={(field, index) => patch('voter', (held) => ({ ...held, extra: { ...held.extra, [field]: index } }))}
                          />
                        )}
                      </div>
                    </div>
                  </fieldset>
                  <fieldset className="panel" id="step3" disabled={!ready}>
                    <legend>Map reason codes</legend>
                    <ReasonMap rows={reasonRows} value={reasonMap} onChange={onReasonCategory} onPreset={onPaPreset} />
                    <p className="row">
                      <button id="runBtn" className="btn-primary" type="button" disabled={!canRun} onClick={() => { void onRun(); }}>Run the match</button>
                      <span id="runMsg" className="small">{policy ? 'Match finished. Review the to-explore pile.' : 'The match stays on this computer.'}</span>
                    </p>
                  </fieldset>
                </>
              ) : (
                <p className="small">This state has no person match. Use the counts-only branch on Add files.</p>
              )}
            </StepPanel>
            <StepPanel id="triage">
              <section id="step4">
                {gates?.allow_jury_list && policy && selectedCounty && (
                  <CountySummary rows={rollup} currentFips={selectedCounty.fips} note={copyNote} onCopy={() => { void onCopySummary(); }} />
                )}
                <h3 className="print-title" id="referralHeader">Referral for official verification — {stateName || 'No state yet'}{selectedCounty ? ` — ${selectedCounty.name} (${selectedCounty.fips})` : ''} — {today}</h3>
                {rules?.state === 'PA' && <p id="paNamesNote">{PA_NAMES_ONLY_NOTE}</p>}
                {rules?.state === 'NC' && <p id="ncNamesNote">{NC_LIST_NOTE}</p>}
                {policy && coreResult && (
                  <>
                    <p id="matcherCounts">Matcher before state rules: Strong {coreResult.counts.Strong}, Probable {coreResult.counts.Probable}, Weak {coreResult.counts.Weak}.</p>
                    <div className="cards">
                      <div id="countStrong" className="card"><span className="n">{policy.counts.Strong}</span> Strong</div>
                      <div id="countProbable" className="card"><span className="n">{policy.counts.Probable}</span> Probable</div>
                      <div id="countWeak" className="card"><span className="n">{policy.counts.Weak}</span> Weak</div>
                    </div>
                    {policy.capBadge && <p className="note" id="tierCapBadge">{policy.capBadge}</p>}
                    <p id="excludedLine"><b>{policy.excludedLine}</b></p>
                    <p id="cannotCompareLine"><b>{policy.cannotCompareLine}</b></p>
                    <details className="bucket sen-acc">
                      <summary><i className="icon-star" aria-hidden="true" /> Excluded: registered after declaration ({policy.excludedAfterCount})</summary>
                      <p>These pairs stay out of the to-explore pile. The voter registered after the jury declaration.</p>
                    </details>
                    <details className="bucket sen-acc">
                      <summary><i className="icon-star" aria-hidden="true" /> Cannot compare: no registration date ({policy.cannotCompareCount})</summary>
                      <p>These pairs stay out of the to-explore pile. One of the dates is missing, so the order cannot be checked.</p>
                    </details>
                    <p className="small" id="regDateNote">Some voter files show the date of the latest registration change, not the first registration. That excludes more matches, which is the safe direction.</p>
                    {rules && NON_SIGNAL[rules.state] && <p id="nonSignalCounts">These counts are {NON_SIGNAL_LABEL}.</p>}
                    <p id="symmetricCount">Non-citizen removal reasons on the voter file: {policy.symmetric.noncitizenRemovals}. Without a Strong jury match: {policy.symmetric.withoutStrongMatch}.</p>
                    <p className="small">Possible wrongful removals, count only: {policy.wrongfulCount}. Official SAVE / naturalization check required.</p>
                    {targets.length > 0 && (
                      <div id="referralTargets">
                        <h3>Send a referral only to these offices</h3>
                        <ul>{targets.map((target) => <li key={target.url}><a href={target.url}>{target.name}</a></li>)}</ul>
                      </div>
                    )}
                    {named && (
                      <>
                        <div className="to-explore" id="toExplore">
                          <h3>To explore</h3>
                          <LeadPile tier="Strong" rows={mainRows} history={voterHistory} />
                          <LeadPile tier="Probable" rows={mainRows} history={voterHistory} />
                        </div>
                        <ResultsTable id="results" rows={mainRows} />
                        {removedRows.length > 0 && (
                          <div id="alreadyRemoved">
                            <h3>Already removed: confirm the removal was correct</h3>
                            <ResultsTable rows={removedRows} />
                          </div>
                        )}
                        <details className="sen-acc" id="weakDetails">
                          <summary><i className="icon-star" aria-hidden="true" /> Weak matches ({policy.counts.Weak})</summary>
                          <label className="inline"><input id="showWeak" type="checkbox" checked={showWeak} onChange={(event) => setShowWeak(event.target.checked)} /> Show weak matches (name only)</label>
                          {showWeak && <p className="warn" id="weakWarn">{WEAK_CAUTION}</p>}
                          {showWeak && <LeadPile tier="Weak" rows={weakRows} history={voterHistory} />}
                          {showWeak && <ResultsTable rows={weakRows} />}
                        </details>
                      </>
                    )}
                    {!gates?.allow_named_export && <p id="aggregateOnly">This state shows counts only. No names are on this page and none can be exported.</p>}
                  </>
                )}
                {!policy && <p className="small">Results appear here after a match. Counts-only states use the audit letter instead of a person list.</p>}
              </section>
            </StepPanel>
            <StepPanel id="export">
              <p>Export names only the offices in the rules file, for the county on step 1.</p>
              {named && (
                <p className="row no-print">
                  <button id="exportBtn" className="btn-primary" type="button" disabled={!selectedCounty} onClick={() => { void onExport(); }}>Export CSV: Referral for official verification</button>
                </p>
              )}
              {!policy && <p className="small">Run the match before you export.</p>}
              {policy && !gates?.allow_named_export && <p id="aggregateExport">This state shows counts only. Download the counts-only letter from Add files.</p>}
            </StepPanel>
          </Stepper>

          <IconBox id="privacy" icon="icon-check" title="On this computer">
            <p><b>{PRIVACY_LEAD}</b> {PRIVACY_BODY}</p>
          </IconBox>
          {inFederal && (
            <IconBox id="federalBanner" icon="icon-calander" title="Federal 90-day window" role="status">
              <p>
                <b>Do not file bulk challenges. Refer leads instead.</b>
                <span> The window for {election} is {window90.start} through {window90.end}. Today is {today}. </span>
                <a className="why" href="#/law/blackout">Why?</a>
              </p>
            </IconBox>
          )}
          {rules && (
            <details className="state-brief sen-acc" id="stateNotices">
              <summary><i className="icon-star" aria-hidden="true" /> <span id="stateBrief">{stateName}: {gates?.allow_named_export ? 'named leads allowed. Referral only.' : 'counts only.'} Why?</span></summary>
              {NON_SIGNAL[rules.state] && (
                <p className="banner" id="nonSignalBanner" role="status">
                  {NON_SIGNAL[rules.state]} Match counts are {NON_SIGNAL_LABEL}. <a className="why" href="#/law/blackout">Why?</a>
                </p>
              )}
              {rules.state === 'ND' && <p className="banner" id="ndBanner" role="status">{ND_REGISTRATION_NOTE}</p>}
              {useLimitApplies(rules) && (
                <section id="useLimitBanner">
                  <p><b>Your state limits how its voter list may be used. Read the rule before you load a file.</b> <a className="why" href="#/law/use">Why?</a></p>
                  {rules.voter_file.permitted_uses && <p id="useLimitQuote">{rules.voter_file.permitted_uses}</p>}
                  {rules.voter_file.source_url && <p><a id="useLimitSource" href={rules.voter_file.source_url} target="_blank" rel="noopener noreferrer">{rules.voter_file.source_url}</a></p>}
                </section>
              )}
              {gates?.show_challenge_guidance && (
                <section id="challengePanel">
                  <h2>Private challenge</h2>
                  {rules.private_challenge.juryroll_lead_sufficient !== true && (
                    <p className="banner" id="leadBanner">A JuryRoll match alone does not meet this standard. Referral is the recommended path. <a className="why" href="#/law/challenge">Why?</a></p>
                  )}
                  {deadlinePassed && deadlineDate && (
                    <p className="banner" id="deadlineBanner">The state deadline for this election has passed ({deadlineDate}).</p>
                  )}
                  {strict(rules.private_challenge.one_per_affidavit, true) && <p id="oneAffidavit">Use one affidavit for one voter.</p>}
                  {rules.private_challenge.who && <p>{rules.private_challenge.who}</p>}
                  {rules.private_challenge.form_or_statute && <p>{rules.private_challenge.form_or_statute}</p>}
                  {rules.private_challenge.evidence_standard && <p>{rules.private_challenge.evidence_standard}</p>}
                  {rules.private_challenge.deadlines && <p>{rules.private_challenge.deadlines}</p>}
                  {rules.private_challenge.false_statement_penalty && <p>{rules.private_challenge.false_statement_penalty}</p>}
                  {rules.private_challenge.form_url && !deadlinePassed && (
                    <p><a id="challengeFormLink" href={rules.private_challenge.form_url} target="_blank" rel="noopener noreferrer">Official challenge form</a></p>
                  )}
                </section>
              )}
              <p><a href={`#/state/${code.toLowerCase()}`}>Open the {stateName} walkthrough</a></p>
            </details>
          )}
          {code && !selectedCounty && <p id="countyRequired" className="note">Choose a county before you run a match or export.</p>}

          <section className="panel no-print" id="downloadsPanel">
            <h2>Blank templates and fictional samples</h2>
            <p className="small" id="templateDateNote">The registration date is needed for a named referral.</p>
            <div className="downloads">
              <a href={jurorTemplateUrl} download="juror-template.csv">Blank juror template (CSV)</a>
              <a href={jurorTemplateXlsxUrl} download="juror-template.xlsx">Blank juror template (Excel)</a>
              <a href={voterTemplateUrl} download="voter-template.csv">Blank voter template (CSV)</a>
              <a href={voterTemplateXlsxUrl} download="voter-template.xlsx">Blank voter template (Excel)</a>
              <a href={jurorSampleUrl} download="sample_juror_disqualifications.csv">Fictional juror sample (CSV)</a>
              <a href={jurorSampleXlsxUrl} download="sample_juror_disqualifications.xlsx">Fictional juror sample (Excel)</a>
              <a href={voterSampleUrl} download="sample_voter_roll.csv">Fictional voter sample (CSV)</a>
              <a href={voterSampleXlsxUrl} download="sample_voter_roll.xlsx">Fictional voter sample (Excel)</a>
            </div>
          </section>
        </>
      );
      break;
    default: {
      const neverRoute: never = route;
      page = neverRoute;
      break;
    }
  }

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar navbar-area nav-style-01">
        <div className="nav-container">
          <a className="brand" href="#/run">JuryRoll</a>
          <nav className="nav" aria-label="Sections">
            <a href="#/run" aria-current={section === 'home' ? 'page' : undefined}>Run a check</a>
            <a href="#/states" aria-current={section === 'states' ? 'page' : undefined}>State walkthroughs</a>
            <a href="#/law" aria-current={section === 'law' ? 'page' : undefined}>Law &amp; guidance</a>
            <a href="#/faq" aria-current={section === 'faq' ? 'page' : undefined}>FAQ</a>
          </nav>
          <div className="nav-actions">
            <button id="purgeBtn" type="button" className="quiet purge-btn" onClick={() => { if (window.confirm('Purge the loaded data and the audit log now? Download the log first if you need it.')) purge('button'); }}>Purge data</button>
            <div className="btn-wrapper">
              <a className="boxed-btn btn-sanatory" href={runHref}>
                Run a check
                <i className="icon-paper-plan" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </header>
      <main id="main">
        {banner && <PageBanner title={banner.title} crumbs={banner.crumbs} />}
        {route.name === 'home' && <HomeHero />}
        <div className="wrap">
          {page}
        <section className="print-only" id="caveats">
          <h2>Read this before you use a result</h2>
          <ul className="caveats">
            {CAVEATS.map((item) => <li key={item.html} dangerouslySetInnerHTML={{ __html: item.html }} />)}
          </ul>
        </section>
        <section className="print-only" id="tierRules">
          <h2>How a tier is chosen</h2>
          <ul>
            {TIER_RULES.map((tier) => <li key={tier.name}><b>{tier.name}.</b> {tier.text}</li>)}
          </ul>
        </section>
        <section className="panel no-print" id="logPanel">
          <h2>Audit log</h2>
          <p className="small">{logCount} entries on this computer. The log does not contain the files or the results.</p>
          <p className="small" id="auditLogNote">You can download this audit log before you choose a county. It is your own accountability record, and it has to be available before a purge. Referral and letter exports still require a county.</p>
          {integrity && <p id="logIntegrity" role="status">{integrity}</p>}
          {memWarn && <p className="warn" id="auditWarn">The log will be lost when you close the page. Download it.</p>}
          <label className="inline"><input id="includeIdsInLog" type="checkbox" checked={includeIds} onChange={(event) => setIncludeIds(event.target.checked)} /> Include voter IDs in the export log entry</label>
          <button id="downloadLog" type="button" className="quiet" onClick={onDownloadLog}>Download audit log</button>
        </section>
        </div>
      </main>
      {route.name === 'home' && <SideTab />}
      <footer className="footer-area">
        <div className="footer-inner">
          <p className="footer-privacy">All processing stays in this browser. No data leaves this computer. A match is a lead for officials. It is not proof.</p>
          <p className="foot" id="appFooter">JuryRoll {APP_VERSION} · build {__BUILD_ID__}. A match is a lead for officials. It is not proof.</p>
        </div>
      </footer>
      <TranscriptionSheet />
      {modal && (
        <div className="modal-back">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="purgeTitle">
            <h2 id="purgeTitle">Referral saved. Purge the data now?</h2>
            <p id="purgeLogModal">Purge also deletes the audit log. Download it first if you need it.</p>
            <p className="row">
              <button id="purgeNow" type="button" onClick={() => purge('after_export')}>Purge now</button>
              <button id="keepData" type="button" className="quiet" onClick={() => setModal(false)}>Keep for 10 minutes</button>
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function LeadPile({ tier, rows, history }: { tier: 'Strong' | 'Probable' | 'Weak'; rows: PolicyRow[]; history: Record<string, string> }) {
  const rule = TIER_RULES.find((item) => item.name === tier);
  const mine = rows.filter((row) => row.tier === tier);
  return (
    <section className="tier-pile">
      <h3>{tier}</h3>
      {rule && <p className="small">{rule.text} <a className="why" href="#/law/tiers">Why?</a></p>}
      {mine.length === 0 && <p className="small">None in this tier.</p>}
      {mine.map((row) => (
        <article className="lead-card" key={`${row.jurorId}-${row.voterId}-${row.tier}`}>
          <h4>{row.voterName}</h4>
          <p>Matched: {row.matched}</p>
          <p>Jury reason: {row.reason}</p>
          <p>{row.notes.join(' ')}</p>
          {history[row.voterId] && <p className="context-note">Voting history: {history[row.voterId]}. Context only, not evidence.</p>}
        </article>
      ))}
    </section>
  );
}


const DATE_ROWS: readonly { field: DateField; label: string }[] = [
  { field: 'declDate', label: 'Declaration date' },
  { field: 'regDate', label: 'Registration date' },
];

function MapTable({ id, headers, map, fields, extra, onChange, onExtra }: {
  id: string;
  headers: string[];
  map: Record<string, number>;
  fields: string[];
  extra: ExtraColumns;
  onChange: (field: string, index: number) => void;
  onExtra: (field: DateField, index: number) => void;
}) {
  return (
    <table className="maptable" id={id}>
      <tbody>
        {fields.map((field) => {
          const def = core.FIELDS[field];
          return (
            <tr key={field}>
              <th>{def.label}{def.req ? ' (required)' : ''}</th>
              <td>
                <select aria-label={def.label} value={map[field] ?? -1} onChange={(event) => onChange(field, Number(event.target.value))}>
                  <option value={-1}>Not in this file</option>
                  {headers.map((header, index) => <option key={`${header}-${index}`} value={index}>{header}</option>)}
                </select>
              </td>
            </tr>
          );
        })}
        {DATE_ROWS.map((row) => (
          <tr key={row.field}>
            <th>{row.label}</th>
            <td>
              <select id={`${id}-${row.field}`} aria-label={row.label} value={extra[row.field]} onChange={(event) => onExtra(row.field, Number(event.target.value))}>
                <option value={-1}>Not in this file</option>
                {headers.map((header, index) => <option key={`${header}-${index}`} value={index}>{header}</option>)}
              </select>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ResultsTable({ rows, id }: { rows: PolicyRow[]; id?: string }) {
  return (
    <div className="scroll">
      <table id={id}>
        <thead>
          <tr>
            <th>Tier</th><th>Voter name</th><th>Voter DOB</th><th>Address</th><th>Status</th><th>Registration date</th><th>Jury declaration date</th><th>Flags</th><th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.jurorId}-${row.voterId}-${row.tier}`}>
              <td>{row.tier}</td>
              <td>{row.voterName}</td>
              <td>{row.voterDob}</td>
              <td>{row.voterAddress}</td>
              <td>{row.voterStatus}</td>
              <td>{row.regDate}</td>
              <td>{row.declDate}</td>
              <td>{row.flags.map((flag) => flagLabel(flag)).join(', ')}</td>
              <td>{row.notes.join(' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
