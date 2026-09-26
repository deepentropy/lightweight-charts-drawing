import { defineConfig } from 'vite';

// Demo (npm run demo / build:demo): root demo/, static data in demo/public
// (SPY.csv). The demo imports the library from source (../src).
export default defineConfig({
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
