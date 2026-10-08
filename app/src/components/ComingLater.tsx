import type { ReactNode } from 'react';
import type { RulesFile } from '../../../shared/src/policy/gates.ts';
import { auditPathCopy, checkPageRefusalLines } from '../../../shared/src/policy/refusal.ts';

type ComingLaterProps = {
  stateName: string;
  basis: string;
  rules: RulesFile | null;
  today: string;
  clearedNote: string;
  links: readonly ComingLaterLink[];
  picker: ReactNode;
  map: ReactNode;
};

export type ComingLaterLink = {
  id: string;
  href: string;
  label: string;
};

/** Short line derived from the jury-list gate. The verbatim basis stays behind Why?. */
export function comingLaterReason(stateName: string): string {
  return `${stateName}: counts only. JuryRoll can't load the jury list here.`;
}

export function ComingLater({ stateName, basis, rules, today, clearedNote, links, picker, map }: ComingLaterProps) {
  const reason = comingLaterReason(stateName);
  const auditLines = auditPathCopy(rules?.audit_path);
  const refusalLines = rules ? checkPageRefusalLines(rules, basis, today) : [];
  const showNow = auditLines.length > 0 || links.length > 0;
  return (
    <div className="stepper-block mode-run has-map mode-later">
      <p id="stepLive" className="visually-hidden" aria-live="polite">
        {stateName}. JuryRoll doesn't support this state yet. {reason}
      </p>
      <div className="workflow-split">
        <article className="step-card coming-later" id="comingLater">
          {picker}
          <p className="kicker">Coming later</p>
          <h2>{stateName}</h2>
          <p id="comingLaterPlan">JuryRoll doesn't support this state yet. It's planned for a future release.</p>
          <p id="comingReason">{reason}</p>
          {showNow && (
            <section id="whatNow" className="what-now">
              <h3>What you can do now</h3>
              {auditLines.map((line, index) => (
                <p key={line} id={index === 0 ? 'auditRequest' : 'auditNote'}>{line}</p>
              ))}
              {links.length > 0 && (
                <p className="what-now-links">
                  {links.map((link) => <a key={link.id} id={link.id} href={link.href}>{link.label}</a>)}
                </p>
              )}
            </section>
          )}
          <details className="basis-why" key={stateName}>
            <summary>Why?</summary>
            <p id="stepBasis">{basis}</p>
            {refusalLines.map((line) => <p key={line.id} id={line.id}>{line.text}</p>)}
          </details>
          {clearedNote && <p className="banner" id="jurorCleared" role="status">{clearedNote}</p>}
        </article>
        <aside className="workflow-map" aria-label="County map">
          {map}
        </aside>
      </div>
    </div>
  );
}
