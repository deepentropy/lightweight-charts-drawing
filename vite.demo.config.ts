import { defineConfig } from 'vite';
import { readFileSync } from 'fs';

// Demo (npm run demo / build:demo): root demo/, static data in demo/public
// (SPY.csv). The demo imports the library from source (../src).
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig({
  define: { __VERSION__: JSON.stringify(version) },
  root: 'demo',
  publicDir: 'public',
  base: '/lightweight-charts-drawing/',
  build: {
    outDir: '../dist-demo',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    open: true,
  },
});
