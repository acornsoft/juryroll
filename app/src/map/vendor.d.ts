declare module 'd3-geo' {
  export type GeoPath = {
    (object: unknown): string | null;
    bounds(object: unknown): [[number, number], [number, number]];
  };
  export type GeoProjection = {
    fitExtent(extent: [[number, number], [number, number]], object: unknown): GeoProjection;
  };
  export function geoAlbersUsa(): GeoProjection;
  export function geoPath(projection: GeoProjection): GeoPath;
}

declare module 'topojson-client' {
  export function feature(topology: unknown, object: unknown): unknown;
}
