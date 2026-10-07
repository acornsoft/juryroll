import type { ReactNode } from 'react';

type ComingLaterProps = {
  stateName: string;
  basis: string;
  clearedNote: string;
  picker: ReactNode;
  map: ReactNode;
};

/** Short line derived from the jury-list gate. The verbatim basis stays behind Why?. */
export function comingLaterReason(stateName: string): string {
  return `${stateName}: counts only. JuryRoll can't load the jury list here.`;
}

export function ComingLater({ stateName, basis, clearedNote, picker, map }: ComingLaterProps) {
  const reason = comingLaterReason(stateName);
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
          <details className="basis-why" key={stateName}>
            <summary>Why?</summary>
            <p id="stepBasis">{basis}</p>
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
