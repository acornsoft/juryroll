export type PopulationFile = {
  vintage: number;
  label: string;
  counties: Record<string, number>;
  states: Record<string, number>;
};

export type MapData = {
  counties: unknown;
  states: unknown;
  population: PopulationFile;
};

export type Bounds = [number, number, number, number];

export type ViewBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type StateShape = {
  fips: string;
  code: string;
  d: string;
  bounds: Bounds;
};

export type CountyShape = {
  fips: string;
  stateFips: string;
  d: string;
  bounds: Bounds;
  pop: number;
};

export type Geography = {
  width: number;
  height: number;
  vintage: number;
  states: StateShape[];
  counties: CountyShape[];
  statePop: Record<string, number>;
};

export type MapLevel = 'us' | 'state' | 'county';
