import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildId } from '../scripts/build-id.mjs';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(appDir, '..');

export default defineConfig({
  root: appDir,
  base: './',
  publicDir: path.join(appDir, 'public'),
  define: {
    __BUILD_ID__: JSON.stringify(buildId()),
  },
  plugins: [react()],
  build: {
    outDir: path.join(appDir, 'dist'),
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  server: {
    fs: { allow: [repo] },
  },
});
