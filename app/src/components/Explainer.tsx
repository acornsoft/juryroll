import { DEMO_BANNER } from '../../../shared/src/content/copy.ts';

const VIDEO_SRC = './media/juryroll-explainer.mp4';
const POSTER_SRC = './media/juryroll-explainer-poster.jpg';

export function Explainer() {
  return (
    <section className="explainer no-print" id="explainer" aria-labelledby="explainerTitle">
      <h2 id="explainerTitle">Watch how it works (47 s)</h2>
      <video
        id="explainerVideo"
        className="explainer-player"
        controls
        preload="metadata"
        playsInline
        poster={POSTER_SRC}
        title="JuryRoll explainer, 47 seconds"
        aria-label="JuryRoll explainer, 47 seconds"
      >
        <source src={VIDEO_SRC} type="video/mp4" />
      </video>
      <p className="explainer-note" id="explainerDisclaimer">{DEMO_BANNER}</p>
    </section>
  );
}
