import { defineConfig } from 'vite';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig({
  define: { __VERSION__: JSON.stringify(version) },
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'LightweightChartsDrawing',
      formats: ['es', 'umd'],
      // The package is "type": "module": the UMD file needs the .cjs
      // extension, else Node loads it as ESM and require() gets nothing.
      fileName: (format) => `lightweight-charts-drawing.${format}.${format === 'umd' ? 'cjs' : 'js'}`,
    },
    rollupOptions: {
      external: ['lightweight-charts'],
      output: {
        globals: {
          'lightweight-charts': 'LightweightCharts',
        },
      },
    },
    sourcemap: true,
  },
});
