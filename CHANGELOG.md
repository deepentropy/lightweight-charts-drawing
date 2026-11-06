# Changelog

## Unreleased

### Added

- `formatLabel` option (`DrawingManagerOptions`, also `Coords.formatLabel`):
  host text for every on-canvas label (field names, numbers, dates) with raw
  values; `DrawingLabel` / `LabelFormatter` types exported. Without it the
  labels are unchanged.

## 0.6.3 (02/11/2026)

### Added

- Agent guide for coding agents: `skills/lightweight-charts-drawing/` (SKILL.md,
  references, examples tested in CI) and `AGENTS.md`, shipped in the package (#7).

## 0.6.2 (15/10/2026)

### Changed

- Drawing points are on whole bars, as in the reference app: a time between
  two bars (a point drawn on another interval, a time in a gap between
  sessions) is drawn on the bar that holds it, the last bar opening at or
  before it (`timeToX`, `timeToBarIndex`, `timeToXFallback`); it was
  interpolated between the two bars. The stored time is kept, so the point
  comes back to its own bar on its own interval.
- Drags follow the reference line tool rules: a point that stays on its bar
  keeps its stored time (price-only anchor drags and body moves), a point
  moved to another bar takes that bar's open time (`applyDrag`,
  `translateDrawing`).

### Added

- `FutureAxis.pastSlots` / `pastTime` (optional): bars before the first
  loaded bar on the host's trading calendar (whole bars both ways); without
  them, calendar time with the median bar interval as before.
- `FutureAxis.timeKey` (optional): where a time sits when the bar that holds
  it is looked for (a host maps a daily bar time to its session open).
- `FutureAxis` exported from the package entry.
- Unit tests (`npm test`, vitest).

## 0.6.1 (15/10/2026)

### Added

- `makeCoords(..., getFuture)` (optional 6th argument, `FutureAxis`): bars
  after the last bar on the symbol's trading calendar, given by the host
  (`slots(time, lastTime)`, `time(k, lastTime)`). With it a point placed after
  the last bar takes the open time of its nearest future bar, a future time is
  drawn on the future bar that holds it (`timeToX`, `xToTime`,
  `timeToBarIndex`, `barIndexToTime`, `timeToXFallback`). Without it, calendar
  time with the median bar interval as before.

## 0.6.0 (13/10/2026)

### Added

- `Coords.lowerTimeframe` (optional): bars of the chart symbol on a lower
  timeframe (`bars(resolution, from)`, `barEnd(time)`, `seconds`). The fixed
  range and anchored volume profiles are built from them (timeframe by the
  span of the range: the first of 1, 5, 15, 30, 60, 240 minutes or 1 day
  giving fewer than 5000 bars) and fall back to the chart bars without it.
- Core `kinds/vbp-engine`: the volume profile engine (rows, allocation,
  direction, POC, value area, lower-timeframe choice) shared with the
  OpenTrader profile studies.

### Changed

- Volume profiles follow the reference rules: high / low rounded to the tick,
  "Number Of Rows" picks the ticks per row whose row count is closest to the
  input (rows may pass the high), "Ticks Per Row" rows sit on multiples of the
  row size, a doji's direction comes from the previous close, the value area
  adds the larger neighbour row only while it fits in the value area volume,
  and the POC of equal rows is the one closest to the middle.

## 0.5.1 (08/10/2026)

### Added

- Core `vwapLast(drawing, bars)` (`src/core/kinds/data-series`): the anchored
  VWAP and its deviation at the last bar of any bars of the symbol, not only
  a chart's. `vwapLastValue` is unchanged.

## 0.5.0 (08/10/2026)

### Added

- `DrawingManager.setHidden(id, hidden)`: hide / show one drawing without
  removing it (the drawing's `hidden` flag, saved with it).
- `DrawingManager.setDrawingsVisible(visible)` / `drawingsVisible()` and the
  `visibility` event: hide / show every drawing at once (TradingView "Hide
  all drawings"). Not saved, the drawings are untouched. Hiding disarms the
  tool; arming a tool shows the drawings again.
- Demo: hide all button, hide button in the selection bar.

### Fixed

- A drawing that stops being shown (`hidden`, per-interval visibility) leaves
  the selection and the hover: Delete could remove a drawing that was not
  drawn.

## 0.4.0 (02/10/2026)

### Added

- `fibLevelAt` is exported from the package entry.

### Changed

- `VERSION` is read from `package.json` at build time (vite `define`), so it
  cannot stay behind the package version again.

## 0.3.0 (02/10/2026)

### Added

- `fibLevelAt(d, pts, cursor, w, coords)` (`src/core/scene/fib.ts`): the fib
  retracement / trend-based extension level line under the cursor (within
  6 px): its index in the level list, y, x-range and level text x. For hosts
  that edit a level's text on the chart. Not exported from the package entry.

### Changed

- Anchored VWAP: an unset `fillBackground` draws the band #1 fill (TradingView
  factory: on, transparency 95). Before, only `fillBackground: true` drew it.
- Triangle pattern, head and shoulders: an unset `transparency` is the factory
  85 (was 80), and transparency 100 draws no fill (was a 0.15 opacity
  fallback).

### Fixed

- `VERSION` matches the package version (it stayed at 0.2.4 in 0.2.5).

## 0.2.5 (01/10/2026)

### Added

- Volume profiles (fixed range, anchored): `DrawingStyle.vp`
  (`VolumeProfileStyle`) with the study settings: rows layout (number of
  rows / ticks per row) and row size, volume (Up/Down, Total, Delta), value
  area volume, extend right (fixed range), histogram visibility, row values,
  width (% of the box), placement, up / down and value area colours, VAH /
  VAL / POC lines, developing POC and VA lines, histogram box colour.
  Defaults: `volumeProfileDefaults(kind)`, merged settings:
  `volumeProfileStyle(kind, style)`.

### Changed

- Pitchfan: each level is drawn with its own width and line style.
- Info line: `extendLeft` / `extendRight` continue the line to the pane edges.
- Highlighter: drawn at its width (no 12 px minimum).

## 0.2.4 (01/10/2026)

### Added

- `Drawing.owner` / `NewDrawing.owner`: id of the study whose pane the drawing
  lives in (absent = the main series pane). For hosts with several panes.
- `magnetSnap(dp, coords, mode, snapToIndicators, ohlc = true)`: `ohlc = false`
  snaps only to the indicator values (a pane without the main series).

### Changed

- Vertical line: factory `extendLine: true` (the line runs through every pane).

## 0.2.3 (01/10/2026)

### Changed

- The drawing core folder is `src/core` (was `src/tv`). Internal only: the
  package entry and its exports are unchanged.

### Fixed

- Long / short position: the stop and target handles are hit where they are
  drawn (entry x). The hit test used the middle of the box, so dragging a
  drawn stop or target square moved the whole drawing.

## 0.2.2 (28/09/2026)

### Changed

- Shift gestures follow TradingView Desktop 3.4.1 (new `tv/interact/shift.ts`):
  - 45° snap = TV `snapPoint45Degree`: horizontal keeps the bar and takes
    the reference price, vertical keeps the price and takes the reference
    bar, a diagonal is rounded to a whole bar.
  - New Shift rules: arrow marker, fib circles, fib speed resistance fan,
    price note, note, rotated rectangle (45°); parallel channel, flat
    top/bottom, disjoint channel (2nd point / anchor 1 only); ellipse (circle,
    finished after 2 clicks); rectangle (square rounded to a bar, the preview
    too, and the middle anchors); Gann box (fixed increments, was a square);
    Gann square anchor drag (keeps the price-per-bar ratio).
  - Shift + body drag moves only horizontally or vertically (past 10 px).
  - Removed Shift rules TV does not have: pitchfork family, pitchfan,
    triangle, trend-based fib extension (45°), bar pattern and fixed range
    volume profile (square).
  - Runtime magnet: Shift turns it off only after the first point or while
    dragging an anchor.
  - Ellipse anchor 0 / 1 drag keeps the minor radius (TV).

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
- Checks behind this release: the renderers
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
