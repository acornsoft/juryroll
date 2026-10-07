import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { populationSentence, populationSourceLabel } from '../lib/populationCard.ts';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  easeOutCubic,
  frameBox,
  lerpView,
  mapLevel,
  prefersReducedMotion,
  unionBounds,
  ZOOM_MS,
} from '../map/frame.ts';
import { loadMapData } from '../map/loadData.ts';
import type { CountyShape, Geography, MapLevel, ViewBox } from '../map/mapTypes.ts';
import { projectMap } from '../map/project.ts';
import { STATES } from '../states.ts';
import type { County } from '../../../shared/src/counties.ts';

type UsMapProps = {
  stateCode: string;
  countyFips: string;
  counties: County[];
  onState: (code: string) => void;
  onCounty: (fips: string) => void;
};

const US_VIEW: ViewBox = { x: 0, y: 0, w: MAP_WIDTH, h: MAP_HEIGHT };

function stateNameOf(code: string): string {
  return STATES.find((item) => item[0] === code)?.[1] ?? code;
}

function targetView(geo: Geography, stateCode: string, countyFips: string): ViewBox {
  const aspect = geo.width / geo.height;
  const level = mapLevel(stateCode, countyFips);
  if (level === 'county') {
    const county = geo.counties.find((item) => item.fips === countyFips);
    if (county) return frameBox(county.bounds, aspect, 0.22);
  }
  if (level === 'state' || level === 'county') {
    const stateFips = geo.states.find((item) => item.code === stateCode)?.fips;
    const mine = geo.counties.filter((item) => item.stateFips === stateFips);
    if (mine.length > 0) return frameBox(unionBounds(mine.map((item) => item.bounds)), aspect, 0.12);
  }
  return US_VIEW;
}

function onShapeKey(event: KeyboardEvent<SVGPathElement>, choose: () => void) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  choose();
}

export function UsMap({ stateCode, countyFips, counties, onState, onCounty }: UsMapProps) {
  const [geo, setGeo] = useState<Geography | null>(null);
  const [status, setStatus] = useState('Loading the map…');
  const [view, setView] = useState<ViewBox>(US_VIEW);
  const [reduced, setReduced] = useState(false);
  const viewRef = useRef(US_VIEW);
  const frameRef = useRef(0);
  const ready = useRef(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    let cancel = false;
    loadMapData()
      .then((data) => {
        if (cancel) return;
        setGeo(projectMap(data));
        setStatus('');
      })
      .catch(() => {
        if (!cancel) setStatus('The map did not load. Choose a state and county from the lists.');
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!geo) return;
    const next = targetView(geo, stateCode, countyFips);
    const from = viewRef.current;
    cancelAnimationFrame(frameRef.current);
    const jump = !ready.current || prefersReducedMotion();
    ready.current = true;
    if (jump) {
      viewRef.current = next;
      setView(next);
      return undefined;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ZOOM_MS);
      const frame = lerpView(from, next, easeOutCubic(t));
      viewRef.current = frame;
      setView(frame);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [geo, stateCode, countyFips]);

  const byFips = useMemo(() => {
    const map = new Map<string, CountyShape>();
    for (const county of geo?.counties ?? []) map.set(county.fips, county);
    return map;
  }, [geo]);

  if (!geo || status) {
    return (
      <div className="us-map-column">
        <p id="mapStatus" className="small" role="status">{status || 'Loading the map…'}</p>
      </div>
    );
  }

  const level = mapLevel(stateCode, countyFips);
  const stateName = stateNameOf(stateCode);
  const countyName = counties.find((item) => item.fips === countyFips)?.name ?? '';
  const selected = byFips.get(countyFips);
  const stateTotal = selected ? geo.statePop[selected.stateFips] : undefined;
  const visibleCounties = counties.flatMap((item) => {
    const shape = byFips.get(item.fips);
    return shape ? [shape] : [];
  });
  const label = level === 'county' && countyName
    ? `${countyName}, ${stateName}`
    : level === 'state'
      ? stateName
      : 'United States';

  return (
    <div className="us-map-column">
      <div className="map-nav">
        <MapBack level={level} onState={onState} onCounty={onCounty} />
      </div>
      <p id="mapHelp" className="visually-hidden">
        Choose a state, then a county. The lists beside the map do the same thing. Enter or Space selects a focused shape.
      </p>
      <svg
        id="usMap"
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        role="group"
        aria-label={label}
        aria-describedby="mapHelp"
        data-level={level}
        data-motion={reduced ? 'reduced' : 'animated'}
      >
        {level === 'us' && geo.states.map((shape) => (
          <path
            key={shape.code}
            d={shape.d}
            data-code={shape.code}
            tabIndex={0}
            role="button"
            aria-label={stateNameOf(shape.code)}
            onClick={() => onState(shape.code)}
            onKeyDown={(event) => onShapeKey(event, () => onState(shape.code))}
          >
            <title>{stateNameOf(shape.code)}</title>
          </path>
        ))}
        {level !== 'us' && visibleCounties.map((shape) => {
          const name = counties.find((item) => item.fips === shape.fips)?.name ?? shape.fips;
          const selectedCounty = shape.fips === countyFips;
          return (
            <path
              key={shape.fips}
              d={shape.d}
              data-fips={shape.fips}
              className={selectedCounty ? 'is-selected' : undefined}
              tabIndex={0}
              role="button"
              aria-label={`${name}, ${stateName}`}
              aria-pressed={selectedCounty}
              onClick={() => onCounty(shape.fips)}
              onKeyDown={(event) => onShapeKey(event, () => onCounty(shape.fips))}
            >
              <title>{name}</title>
            </path>
          );
        })}
      </svg>
      {level === 'county' && selected && countyName && stateTotal !== undefined && (
        <aside id="populationCard" className="population-card" aria-live="polite">
          <p id="populationCardText">{populationSentence(countyName, stateName, selected.pop, stateTotal)}</p>
          <p id="populationSource" className="population-source">{populationSourceLabel(geo.vintage)}</p>
        </aside>
      )}
    </div>
  );
}

function MapBack({
  level,
  onState,
  onCounty,
}: {
  level: MapLevel;
  onState: (code: string) => void;
  onCounty: (fips: string) => void;
}) {
  switch (level) {
    case 'us':
      return null;
    case 'state':
      return <button type="button" id="mapBackUs" className="quiet" onClick={() => onState('')}>Back to US</button>;
    case 'county':
      return (
        <>
          <button type="button" id="mapBackState" className="quiet" onClick={() => onCounty('')}>Back to state</button>
          <button type="button" id="mapBackUs" className="quiet" onClick={() => onState('')}>Back to US</button>
        </>
      );
    default: {
      const neverLevel: never = level;
      return neverLevel;
    }
  }
}
