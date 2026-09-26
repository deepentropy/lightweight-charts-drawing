# Changelog

## 0.2.1 (26/09/2026)

### Fixed

- `DrawingManager.on(...)`: the first call in a TypeScript file failed with
  TS2590 ("Expression produces a union type that is too complex to
  represent"), also with the published 0.2.0 types. `on` now has one
  overload per event.
- Pin: a press on its anchor (the marker tip) missed about half of the time
  (the tip is on the edge of the marker box). The anchor is now hit first,
  as for the comment and note tools.

### Demo

- TradingView-style left toolbar with the tools under TradingView's groups
  and sections (generated with docs/TOOLS.md by `docs/tools_md.py`), an
  emoji group for the font icon, magnet (weak / strong), keep drawing and
  remove all; a selection bar (Anchor drawing, remove); an inline editor for
  text tools and table cells; export / import as JSON files (the export
  wrote to localStorage before); no event log panel.

## 0.2.0 (26/09/2026)

A new library built on a shared drawing core (`src/tv`) that is also used by
[OpenTrader](https://github.com/deepentropy/opentrader), with a canvas
runtime (`src/runtime`). Breaking: the 0.1 API is removed.

### Breaking changes

- The 0.1 runtime is removed: `Drawing` and every tool class (`TrendLine`,
  `FibRetracement`, …) with their pane views, the 0.1 `DrawingManager`
  (`attach`, `addDrawing`, `selectDrawing`, …), `InteractionHandler`,
  `ToolRegistry` / `getToolRegistry` / `TOOL_DEFINITIONS`, the geometry and
  canvas helpers, `PreviewRenderer`.
- New drawing model: a drawing is plain data `{ id, kind, points: [{ time,
  price }], style, … }` (types `Drawing`, `NewDrawing`, `DrawingStyle`) with
  TradingView field names and factory defaults. The 0.1 JSON format
  (`{ type, anchors, style: { lineColor, … }, options }`) is not read by
  `importJSON`.
- Tool names follow TradingView / OpenTrader:

  | 0.1 | 0.2 |
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

- `anchored-text` is removed. TradingView has retired its Anchored text tool
  in favour of the Text tool with "Anchor drawing" on
  (`toggleAnchored`).
- `fancy-canvas` is no longer a dependency (types only, at build time).

### New

- `DrawingManager(chart, series, options)`: one series primitive draws every
  drawing, the placement preview, the anchors (TradingView style) and the
  drawings' price / time axis labels.
  - Placement by TradingView's rules: clicks, 1-click tools, press-drag for
    brush / highlighter, polyline / path / ghost feed finished by a
    double-click or a click on the last point, the data TradingView computes
    at placement (position levels, bar-pattern snapshot, ghost-feed seed,
    curve controls, trend angle, Gann square), text tools ask the host for
    an editor (`textEdit` event).
  - Hover, multi-select (Ctrl / Cmd), anchor / body / group drags with each
    tool's anchor rules, Ctrl + drag clone, magnet (weak / strong, Shift /
    Ctrl modifiers), Shift 45° / square constraints, Escape / Delete, z-order,
    per-interval visibility, locked drawings, cursors.
  - "Anchor drawing" for Text, Pin and Table (`toggleAnchored`).
  - Table cell editing (`tableEdit` event, `setTableCellText`, `tableOp`),
    images (`addImage` + the image cache hooks).
  - JSON export / import of the drawing model (`exportJSON`, `importJSON`
    with schema check and point-model migration).
- 86 tools with TradingView factory defaults, labels and hit tests
  ([docs/TOOLS.md](docs/TOOLS.md)): lines, channels, pitchforks, Fibonacci
  and Gann tools, chart patterns, Elliott waves, cycles, forecasting and
  measuring tools (positions, ranges, forecast, bar pattern, ghost feed),
  volume-based tools (anchored VWAP, fixed range / anchored volume
  profile), shapes, text and notes, table, image, font icon.
- For hosts that draw their own way: `sceneOf` (renderer-neutral scene of a
  drawing), `drawScene` (canvas), `hitTestKind`, `drawingAxisLabels`,
  `finishPlacement` / `applyDrag` (interaction rules), `makeCoords` (chart ↔
  price / time bridge), `parseDrawings` / `migrateDrawing`.
- The package imports nothing from lightweight-charts at run time (types
  only), so a host keeps a single lightweight-charts copy.

### Notes

- The volume-based tools need bars with a volume: pass them with the
  `bars` option (series data usually has none).
- Checks behind this release (in `docs/port-opentrader/`): the renderers
  match OpenTrader's on 430 golden fixtures, the canvas renderer matches the
  SVG output on 774 fixtures (0.05 % of drawn pixels differ, text
  anti-aliasing), and all 86 tools pass a real-mouse survey (place, select,
  anchor drag, body drag, delete) in the demo.

## 0.1.1 (26/02/2026)

- Description without "professional"; screenshots and the outdated
  changelog removed from the README and docs.

## 0.1.0

- First release: tool classes with canvas pane views, `DrawingManager`,
  tool registry, demo on GitHub Pages.
