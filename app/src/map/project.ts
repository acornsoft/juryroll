import { geoAlbersUsa, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import { MAP_FIT_PAD, MAP_HEIGHT, MAP_WIDTH } from './frame.ts';
import type { Bounds, CountyShape, Geography, MapData, StateShape } from './mapTypes.ts';

type Topology = {
  objects: Record<string, object>;
};

type Drawn = {
  id?: string | number;
  properties?: { usps?: string } | null;
};

function collection(topology: Topology, name: string): Drawn[] {
  const object = topology.objects[name];
  if (!object) throw new Error(`Map data is missing ${name}`);
  const wrapped = feature(topology as never, object as never) as { features?: Drawn[] };
  if (!wrapped.features) throw new Error(`Map data for ${name} has no features`);
  return wrapped.features;
}

function boundsOf(render: ReturnType<typeof geoPath>, item: Drawn): Bounds {
  const box = render.bounds(item as never);
  const [[x0, y0], [x1, y1]] = box;
  if (![x0, y0, x1, y1].every(Number.isFinite)) throw new Error(`Map shape ${String(item.id)} has no bounds`);
  return [x0, y0, x1, y1];
}

export function projectMap(data: MapData): Geography {
  const statesTopo = data.states as Topology;
  const countiesTopo = data.counties as Topology;
  const stateFeatures = collection(statesTopo, 'states');
  const countyFeatures = collection(countiesTopo, 'counties');
  const projection = geoAlbersUsa().fitExtent(
    [[MAP_FIT_PAD, MAP_FIT_PAD], [MAP_WIDTH - MAP_FIT_PAD, MAP_HEIGHT - MAP_FIT_PAD]],
    { type: 'FeatureCollection', features: stateFeatures } as never,
  );
  const render = geoPath(projection);
  const states: StateShape[] = stateFeatures.map((item) => {
    const code = item.properties?.usps ?? '';
    const d = render(item as never);
    if (!code || !d) throw new Error(`State ${String(item.id)} did not project`);
    return { fips: String(item.id).padStart(2, '0'), code, d, bounds: boundsOf(render, item) };
  });
  states.sort((a, b) => a.code.localeCompare(b.code));
  const statePop = data.population.states;
  const counties: CountyShape[] = countyFeatures.map((item) => {
    const fips = String(item.id).padStart(5, '0');
    const d = render(item as never);
    if (!d) throw new Error(`County ${fips} did not project`);
    const pop = data.population.counties[fips];
    if (!Number.isInteger(pop)) throw new Error(`County ${fips} has no population`);
    return {
      fips,
      stateFips: fips.slice(0, 2),
      d,
      bounds: boundsOf(render, item),
      pop,
    };
  });
  counties.sort((a, b) => a.fips.localeCompare(b.fips));
  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    vintage: data.population.vintage,
    states,
    counties,
    statePop,
  };
}
