import { DEMO_BANNER } from '../../../shared/src/content/copy.ts';

export function DemoBanner() {
  return (
    <p className="demo-banner" id="demoBanner" role="region" aria-label="Site status">
      {DEMO_BANNER}{' '}
      <a href="#/disclaimer">Disclaimer</a>
    </p>
  );
}
