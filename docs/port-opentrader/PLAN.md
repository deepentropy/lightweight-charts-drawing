# Port of the OpenTrader drawing work (plan, 25/09/2026)

Source: OpenTrader `src/window/drawings/` (83 tools matched to TradingView
Desktop 3.x: geometry, factory defaults, labels, hit tests, data-driven tools).
Target: this library, version 0.2.0 (breaking).

## Decisions (user, 25/09/2026)

- Shared core: the UI-free drawing logic moves from OpenTrader into this
  library; OpenTrader imports it back. One place to fix a tool.
- Scope: TradingView rendering + factory defaults, hit tests + anchors, the
  tools the library does not have yet. Settings dialogs stay in OpenTrader.
- Public API: breaking change, version 0.2.0 (TradingView style fields and
  OpenTrader tool names).

## Architecture

```
lightweight-charts-drawing
  src/tv/            shared core (no UI, no lightweight-charts runtime import)
    types.ts         Drawing model, DrawingStyle, LevelDef ... (from OT)
    specs.ts         tool specs + TradingView factory defaults (from OT)
    coords.ts        Coords interface (chart <-> screen), OHLC type
    shared.ts        Pt, hit tolerance, distances, time helpers
    kinds/*.ts       hit tests, text layout, data series, per-tool geometry
    scene/           (phase 2) renderer-neutral output per tool:
                     line / polyline / polygon / path / rect / circle /
                     text box / image, with stroke, fill, dash, opacity
  src/ (phase 3)     canvas pane views draw the scene; DrawingManager,
                     registry and interaction rebuilt on the core model
OpenTrader
  imports lightweight-charts-drawing/tv; keeps SolidJS: SVG scene renderer,
  inline text / table editing, settings dialogs, persistence, toolbar
```

`src/tv` imports only types from lightweight-charts, so it adds no runtime
dependency and OpenTrader keeps its own lightweight-charts fork.

## Phases

1. Core extraction (no behaviour change). Move the pure modules
   (types, specs, shared, coords interface, rotated-rect, kinds/*) into
   `src/tv`; cut the UI parts (image cache signal + Tauri calls, table UI
   signal, saved-template override) behind small hooks that OpenTrader
   sets. Library: `lightweight-charts-drawing/tv` export. OpenTrader: depends
   on the library (`file:../lightweight-charts-drawing`), imports the core.
   Check: OpenTrader `tsc`, `vite build`, dialog row survey unchanged, tool
   screenshots unchanged.
2. Scene layer. Per tool group, move the geometry out of the SolidJS
   renderers in `DrawingsOverlay.tsx` into `src/tv/scene` functions that
   return primitives; OpenTrader renders the scene to SVG (interactive parts,
   text editing, stay in OpenTrader). Check per group: OpenTrader
   screenshots before / after identical; OpenTrader render time per frame not
   slower (latency priority).
3. Library runtime on the core. Canvas scene renderer in a pane primitive;
   `DrawingManager` / registry / interaction (placement point counts, drag
   of anchors, hit tests) on the core model and tool names; old tool classes
   removed.
4. All 83 tools available in the library (the missing ones come with 2-3):
   anchored VWAP, fixed / anchored volume profile, ghost feed, bars pattern,
   6 chart patterns, 5 Elliott waves, cyclic lines, time cycles, sine line,
   sector, image, icon ...
5. Demo, README, docs/TOOLS.md, CHANGELOG, version 0.2.0.

## Checks used

- OpenTrader: `tsc --noEmit`, `vite build`, `research/drawings-gap/code/run-tools.cjs`
  (tool screenshots and dialog rows) compared with the committed results.
- Library: `npm run typecheck`, `npm run build`, demo screenshots of every
  tool compared with the OpenTrader screenshots of the same tool.

## Tool names (library 0.1 -> 0.2)

| 0.1 | 0.2 (OpenTrader / TV) |
|---|---|
| fib-extension | trend-based-fib-extension |
| fib-time-extension | trend-based-fib-time |
| fib-arcs | fib-speed-resistance-arcs |
| fib-speed-fan | fib-speed-resistance-fan |
| forecast | position-forecast |
| andrews-pitchfork | pitchfork |
| date-price-range | date-and-price-range |
| bars-pattern | bar-pattern |
| text-annotation | text |
| projection | sector |

`anchored-text` (TradingView "Anchored text") exists only in the library;
OpenTrader has no such tool. Open question for phase 3: keep the 0.1 version
or build it the TradingView way.

## Status

- [x] Phase 1 core extraction (25/09/2026): `src/tv` in place, OpenTrader imports it from source. Packaging of `src/tv` in `dist` (export `./tv`) left for phase 5. Placement survey pending (needs the FSLY 30m pane in OpenTrader).
- [x] Phase 2 scene layer (25/09/2026)
  - [x] scene types (`src/tv/scene/types.ts`), text helpers (`scene/text.ts`)
  - [x] group 1 line tools (`scene/lines.ts`): OpenTrader output identical
    on all 430 golden fixtures, no render slowdown
    (OpenTrader `research/drawings-port`)
  - [x] group 2 channels (`scene/channels.ts`, shared `scene/levels.ts`):
    identical on 430 / 430, A/B render 0.75x (control 0.78x)
  - [x] groups 3-5 fib + pitchfan (`scene/fib.ts`), Gann + pitchforks
    (`scene/gann.ts`): identical except a fixed OpenTrader bug (fib level
    label cut pointed to a missing clip); A/B render 0.53x to 0.87x
  - [x] hit tests: pitchfork geometry (`kinds/pitchfork.ts`) and the Gann
    fan ray (`kinds/gann-fan.ts`) shared by the scenes and the hit tests;
    424 710 cursor checks before / after, 0 different
  - [x] group 6 shapes and cycles (`scene/shapes.ts`; new scene item
    `radialGradient` + paint `fillRef` for the sector): identical on 60 / 60
    fixtures and on 48 extra-option fixtures (fills, end arrows, middle
    line); A/B render 0.89x
  - [x] group 7 patterns, Elliott waves, polyline / path / brush /
    highlighter (`scene/patterns.ts`): identical on 75 / 75 fixtures and 60
    extra-option fixtures; A/B render 0.79x
  - [x] group 8 markers and candle replicas (`scene/markers.ts`, colour
    helpers `tv/color.ts`; scene items `glyph`, group opacity, circle
    cursor): identical on 40 / 40 fixtures and 32 extra-option fixtures;
    A/B render 0.95x
  - [x] group 9 ranges (`scene/ranges.ts`, rect `shadow`): identical on
    15 / 15 fixtures and 12 extra-option fixtures; A/B render 0.68x
  - [x] group 10 data-driven tools (`scene/data.ts`): identical on 20 / 20
    fixtures and 24 extra-option / no-data fixtures; A/B render 0.91x
  - [x] group 11 positions and forecast (`scene/positions.ts`; moved
    `positionAnchors` / `positionTrade`, forecast icons, `tv/time.ts`):
    identical on 15 / 15 fixtures and 18 extra fixtures; A/B render 0.84x
  - [x] group 12 text tools (`scene/text-tools.ts`; placeholders in
    `kinds/text-tools.ts`): identical on 45 / 45 fixtures and 54 extra
    fixtures incl. table UI states; A/B render 0.62x. All tool renderers of
    OpenTrader now draw the core scenes (full A/B 504 / 516, the rest = the
    fib clip fix)
- [ ] Phase 3 library runtime
- [ ] Phase 4 all tools
- [ ] Phase 5 release 0.2.0
