import type { Bounds, MapLevel, ViewBox } from './mapTypes.ts';

export const MAP_WIDTH = 960;
export const MAP_HEIGHT = 600;
export const MAP_FIT_PAD = 12;
export const ZOOM_MS = 720;

export function mapLevel(stateCode: string, countyFips: string): MapLevel {
  if (!stateCode) return 'us';
  if (!countyFips) return 'state';
  return 'county';
}

export function unionBounds(items: Bounds[]): Bounds {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [left, top, right, bottom] of items) {
    x0 = Math.min(x0, left);
    y0 = Math.min(y0, top);
    x1 = Math.max(x1, right);
    y1 = Math.max(y1, bottom);
  }
  return [x0, y0, x1, y1];
}

/** Pad a shape and lock it to the map aspect so the zoom does not stretch. */
export function frameBox(bounds: Bounds, aspect: number, pad: number): ViewBox {
  const [x0, y0, x1, y1] = bounds;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  let w = Math.max(x1 - x0, 1) * (1 + pad);
  let h = Math.max(y1 - y0, 1) * (1 + pad);
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

export function lerpView(from: ViewBox, to: ViewBox, t: number): ViewBox {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    w: from.w + (to.w - from.w) * t,
    h: from.h + (to.h - from.h) * t,
  };
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
