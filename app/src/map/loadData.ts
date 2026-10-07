import type { MapData } from './mapTypes.ts';

const GLOBAL_KEY = 'JURYROLL_MAP_DATA';
const CLASSIC_SRC = './assets/us-map-global.js';

type MapGlobal = typeof globalThis & { [GLOBAL_KEY]?: MapData };

function readGlobal(): MapData | null {
  return (globalThis as MapGlobal)[GLOBAL_KEY] ?? null;
}

function loadClassic(): Promise<MapData> {
  const ready = readGlobal();
  if (ready) return Promise.resolve(ready);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CLASSIC_SRC;
    script.onload = () => {
      const data = readGlobal();
      if (!data) reject(new Error('The map data did not load.'));
      else resolve(data);
    };
    script.onerror = () => reject(new Error('The map data did not load.'));
    document.head.appendChild(script);
  });
}

// Chrome blocks import() of a module from a file:// page. The hosted page
// loads this chunk with import(). Opening the built page from disk uses a
// classic script, which script-src 'self' already allows.
export function loadMapData(): Promise<MapData> {
  if (location.protocol === 'file:') return loadClassic();
  return import('./data.ts').then((mod) => mod.default);
}
