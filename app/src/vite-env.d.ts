/// <reference types="vite/client" />

declare const __BUILD_ID__: string;

declare module '*.csv?raw' {
  const src: string;
  export default src;
}

declare module '*.csv?url' {
  const src: string;
  export default src;
}

declare module '*.xlsx?url' {
  const src: string;
  export default src;
}

declare module '*.md?raw' {
  const src: string;
  export default src;
}
