// Runtime test page (port phase 3.3): npx vite --config demo/runtime/vite.config.ts
// Root = this folder; demo/ is the public folder (SPY.csv at /SPY.csv).
import { defineConfig } from "vite";

export default defineConfig({
  root: "demo/runtime",
  publicDir: "..",
  server: { port: 3007, strictPort: true, open: false },
});
