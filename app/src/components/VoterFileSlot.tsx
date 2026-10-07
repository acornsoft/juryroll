import type { DragEvent } from 'react';
import {
  VOTER_USE_CHECK_LABEL,
  VOTER_USE_DECIDE_LINE,
  VOTER_USE_HEADING,
  VOTER_USE_ONLY_LINE,
} from '../../../shared/src/policy/voterUse.ts';

type VoterFileSlotProps = {
  restriction: string | null;
  sourceUrl: string | null;
  useChecked: boolean;
  onUseChecked: (checked: boolean) => void;
  inputDisabled: boolean;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onFile: (file: File) => void;
  hasHeader: boolean;
  onHeader: (checked: boolean) => void;
  pendingNames: string[] | null;
  onSheet: (name: string) => void;
  info: string | null;
  protectedCount: number;
};

export function VoterFileSlot({
  restriction,
  sourceUrl,
  useChecked,
  onUseChecked,
  inputDisabled,
  onDrop,
  onFile,
  hasHeader,
  onHeader,
  pendingNames,
  onSheet,
  info,
  protectedCount,
}: VoterFileSlotProps) {
  return (
    <div className="voter-file-block">
      {restriction !== null && (
        <section className="panel" id="voterUsePanel" aria-labelledby="voterUseHeading">
          <h3 id="voterUseHeading">{VOTER_USE_HEADING}</h3>
          <p id="voterUseText">{restriction}</p>
          {sourceUrl && (
            <p>
              <a id="voterUseSource" href={sourceUrl} target="_blank" rel="noopener noreferrer">{sourceUrl}</a>
            </p>
          )}
          <p id="voterUseOnly">{VOTER_USE_ONLY_LINE}</p>
          <p id="voterUseDecide">{VOTER_USE_DECIDE_LINE}</p>
          <label className="inline">
            <input
              id="voterUseCheck"
              type="checkbox"
              checked={useChecked}
              onChange={(event) => onUseChecked(event.target.checked)}
            />
            <span>{VOTER_USE_CHECK_LABEL}</span>
          </label>
        </section>
      )}
      <div
        id="voterSlot"
        className="drop-card"
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
      >
        <div className="drop-head">
          <span className="drop-num idle">b</span>
          <span className="drop-name">Add the voter roll</span>
          <label className="inline">
            <input id="hdrVoter" type="checkbox" checked={hasHeader} onChange={(event) => onHeader(event.target.checked)} />
            {' '}First row has column names
          </label>
        </div>
        <div className="drop-body">
          <span className="drop-copy"><b>Drop the county voter file</b><br />CSV or Excel</span>
          <label className="choose-file">
            <input
              id="fileVoter"
              type="file"
              aria-label="Choose file, county voter roll"
              accept=".csv,.txt,.tsv,.xlsx,.xls,text/csv"
              disabled={inputDisabled}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onFile(file);
              }}
            />
          </label>
        </div>
        {pendingNames && (
          <label>
            Choose a sheet
            <select id="voterSheet" defaultValue="" onChange={(event) => { const name = event.target.value; if (name) onSheet(name); }}>
              <option value="">Choose a sheet</option>
              {pendingNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
        )}
        {info && <p className="small" id="infoVoter">{info}</p>}
        {protectedCount > 0 && <p className="note" id="protectedRecords">{protectedCount} protected record: cannot compare</p>}
      </div>
    </div>
  );
}
