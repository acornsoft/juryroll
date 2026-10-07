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
import type { Bounds, CountyShape, Geography, MapLevel, ViewBox } from '../map/mapTypes.ts';
import { projectMap } from '../map/project.ts';
import { juryListAllowed } from '../lib/availability.ts';
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
  const svgRef = useRef<SVGSVGElement>(null);
  const [svgWidth, setSvgWidth] = useState(0);

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
    const node = svgRef.current;
    if (!node) return undefined;
    const measure = () => setSvgWidth(node.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [geo, stateCode, countyFips]);

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
  const stateLater = Boolean(stateCode) && !juryListAllowed(stateCode);
  const pinScale = svgWidth > 0 ? view.w / svgWidth : 0.2;
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
      <div className="map-head">
        {level !== 'us' && <h3 className="map-state">{stateName}</h3>}
        <div className="map-nav">
          <MapBack level={level} onState={onState} onCounty={onCounty} />
        </div>
      </div>
      <p id="mapHelp" className="visually-hidden">
        Choose a state, then a county. The lists beside the map do the same thing. Enter or Space selects a focused shape.
      </p>
      <svg
        id="usMap"
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        role="group"
        aria-label={label}
        aria-describedby="mapHelp"
        data-level={level}
        data-motion={reduced ? 'reduced' : 'animated'}
      >
        {level === 'us' && geo.states.map((shape) => {
          const later = !juryListAllowed(shape.code);
          const name = stateNameOf(shape.code);
          return (
            <path
              key={shape.code}
              d={shape.d}
              data-code={shape.code}
              className={later ? 'is-later' : 'is-available'}
              tabIndex={0}
              role="button"
              aria-label={later ? `${name}, coming later` : name}
              onClick={() => onState(shape.code)}
              onKeyDown={(event) => onShapeKey(event, () => onState(shape.code))}
            >
              <title>{later ? `${name} (coming later)` : name}</title>
            </path>
          );
        })}
        {level !== 'us' && visibleCounties.map((shape) => {
          const name = counties.find((item) => item.fips === shape.fips)?.name ?? shape.fips;
          const selectedCounty = shape.fips === countyFips;
          const countyClass = [stateLater ? 'is-later' : '', selectedCounty ? 'is-selected' : ''].filter(Boolean).join(' ');
          return (
            <path
              key={shape.fips}
              d={shape.d}
              data-fips={shape.fips}
              className={countyClass || undefined}
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
        {level !== 'us' && selected && countyName && (
          <CountyPin bounds={selected.bounds} name={countyName} view={view} scale={pinScale} />
        )}
      </svg>
      {level === 'us' && (
        <ul className="map-legend" aria-label="Map legend">
          <li><span className="swatch is-available" aria-hidden="true" /> Available</li>
          <li><span className="swatch is-later" aria-hidden="true" /> Coming later</li>
        </ul>
      )}
      {level === 'county' && selected && countyName && stateTotal !== undefined && (
        <aside id="populationCard" className="population-card" aria-live="polite">
          <p id="populationCardText">{populationSentence(countyName, stateName, selected.pop, stateTotal)}</p>
          <p id="populationSource" className="population-source">{populationSourceLabel(geo.vintage)}</p>
        </aside>
      )}
    </div>
  );
}

function CountyPin({ bounds, name, view, scale }: { bounds: Bounds; name: string; view: ViewBox; scale: number }) {
  const [x0, y0, x1, y1] = bounds;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const font = 13 * scale;
  const padX = 8 * scale;
  const padY = 5 * scale;
  const textW = name.length * font * 0.56;
  const gap = 14 * scale;
  const height = font + padY * 2;
  const toLeft = cx > view.x + view.w * 0.68;
  const x2 = toLeft ? cx - gap : cx + gap;
  const rectX = toLeft ? x2 - textW - padX * 2 : x2;
  const textX = toLeft ? x2 - padX : x2 + padX;
  return (
    <g className="county-pin" pointerEvents="none">
      <line x1={cx} y1={cy} x2={x2} y2={cy} stroke="#04072E" strokeWidth={1.5 * scale} />
      <rect x={rectX} y={cy - height / 2} width={textW + padX * 2} height={height} rx={4 * scale} fill="#04072E" />
      <text x={textX} y={cy} textAnchor={toLeft ? 'end' : 'start'} dominantBaseline="middle" fill="#fff" fontSize={font} fontFamily="Roboto, sans-serif" fontWeight={600}>{name}</text>
    </g>
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
