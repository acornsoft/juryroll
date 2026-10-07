import { SUMMARY_DISCLAIMER, summaryLine, type CountyRun } from '../lib/summary.ts';

export function CountySummary({
  rows,
  currentFips,
  note,
  onCopy,
}: {
  rows: readonly CountyRun[];
  currentFips: string;
  note: string;
  onCopy: () => void;
}) {
  const current = rows.find((row) => row.countyFips === currentFips) ?? rows[rows.length - 1];
  if (!current) return null;
  return (
    <section className="panel" id="countySummaryCard">
      <h3>County summary</h3>
      <p id="countySummary">{summaryLine(current)}</p>
      <p className="small" id="summaryDisclaimer">{SUMMARY_DISCLAIMER}</p>
      <p className="row">
        <button id="copySummary" type="button" className="quiet" onClick={onCopy}>Copy summary</button>
      </p>
      {note && <p id="copySummaryStatus" className="note">{note}</p>}
      <div className="scroll">
        <table id="countyRollup">
          <caption>Counties checked this session. One row per county. Cleared by Purge.</caption>
          <thead>
            <tr>
              <th>County</th>
              <th>Entered</th>
              <th>Non-citizen</th>
              <th>Language excluded</th>
              <th>Non-resident excluded</th>
              <th>Strong</th>
              <th>Probable</th>
              <th>Weak</th>
              <th>Excluded</th>
              <th>Cannot compare</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.stateCode}-${row.countyFips}`}>
                <td>{row.countyName}</td>
                <td>{row.entered}</td>
                <td>{row.nonCitizen}</td>
                <td>{row.language}</td>
                <td>{row.nonResident}</td>
                <td>{row.strong}</td>
                <td>{row.probable}</td>
                <td>{row.weak}</td>
                <td>{row.excluded}</td>
                <td>{row.cannotCompare}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
