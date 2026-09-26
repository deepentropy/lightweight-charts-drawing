# lightweight-charts-drawing

**[Live Demo](https://deepentropy.github.io/lightweight-charts-drawing/)**

TradingView-style drawing tools for [lightweight-charts](https://github.com/tradingview/lightweight-charts) v5:
86 tools with TradingView's factory defaults, labels, hit tests, placement
and anchor rules (trend lines, channels, pitchforks, Fibonacci and Gann
tools, patterns, Elliott waves, cycles, forecasting and measuring tools,
volume-based tools, shapes, text and notes). List: [docs/TOOLS.md](docs/TOOLS.md).

> Version 0.2 is in progress (not published yet) and breaks the 0.1 API:
> the tool classes of 0.1 are replaced by one `DrawingManager` on a shared
> drawing core. Plan and status:
> [docs/port-opentrader/PLAN.md](docs/port-opentrader/PLAN.md).

## Installation

```bash
npm install lightweight-charts-drawing lightweight-charts
```

## Quick start

```typescript
import { createChart, CandlestickSeries } from 'lightweight-charts';
import { DrawingManager } from 'lightweight-charts-drawing';

const chart = createChart(document.getElementById('chart')!, { autoSize: true });
const series = chart.addSeries(CandlestickSeries);
series.setData(bars); // your OHLC data

const drawings = new DrawingManager(chart, series, { magnet: 'weak' });

// Arm a tool: the user places it with the mouse (TV clicks / drag rules).
drawings.setTool('fib-retracement');

// Or add one in code (the tool's TradingView defaults fill the style).
drawings.add({ kind: 'trend-line', points: [
  { time: bars[10].time, price: bars[10].low },
  { time: bars[40].time, price: bars[40].high },
] });

// Save / restore (the core Drawing model, checked and migrated on import).
localStorage.setItem('drawings', drawings.exportJSON());
drawings.importJSON(localStorage.getItem('drawings') ?? '[]');
```

## DrawingManager

`new DrawingManager(chart, series, options?)` attaches one series primitive
that draws every drawing, the placement preview, the anchors and the
drawings' axis labels.

Options: `bars` (bar getter with volume; default the series data, which
usually has no volume: the volume profiles then show no rows and the
anchored VWAP uses equal weights), `fontFamily`
(default the chart font), `magnet` (`'off' | 'weak' | 'strong'`), `interval`
(per-interval visibility, TV Visibility tab), `timeInfo` (time zone /
intraday of date labels), `stayInDrawingMode` (TV Keep drawing).

| Method | |
|---|---|
| `setTool(kind \| null, { glyph? })`, `tool()` | arm / disarm a tool (`kind` from docs/TOOLS.md) |
| `setMagnet(mode)`, `setInterval(i)`, `setStayInDrawingMode(on)` | settings |
| `add(drawing)`, `update(drawing)`, `remove(id)`, `clear()`, `get(id)`, `drawings()` | drawings |
| `select(ids)`, `selection()` | selection (multi-select with Ctrl / Cmd) |
| `bringToFront(id)`, `sendToBack(id)` | z-order |
| `toggleAnchored(id)` | TV "Anchor drawing" for Text, Pin and Table: the drawing keeps its pane position when the chart scrolls (`isAnchorable(kind)`) |
| `exportJSON()`, `importJSON(json)` | save / restore |
| `addImage({ name, width, height })` | place an image (file put in the image cache by the host: `cacheImage` / `setImageReader`) |
| `setTableCellText(id, cell, text)`, `endTableEdit()`, `tableOp(id, op)`, `tableState()` | table cell editing (after a `tableEdit` event) and row / column operations |
| `on(event, cb)` → unsubscribe | events |
| `redraw()`, `destroy()` | |

Events: `change`, `add`, `update`, `remove`, `selection`, `tool`,
`textEdit` (a text tool was placed or double-clicked: open your editor at
the given pane point and `update` the drawing's `text`), `tableEdit` (a click
on a cell of the selected table: open your editor over the given cell box),
`gestureEnd` (end of a drag / placement, for undo grouping).

Mouse and keys (TradingView behaviour): placement by clicks, press-drag for
brush / highlighter, double-click (or a click on the last point) finishes a
path / polyline; anchor drags, body drag of a selected drawing, Ctrl / Cmd
click to multi-select and group drag, Ctrl + body drag clones; Shift = 45°
steps / square boxes and magnet off, Ctrl / Cmd inverts the magnet; Escape
drops pending points, then the tool, then the selection; Delete removes the
selection (locked drawings stay).

The host keeps what is not drawing logic: undo stack, storage, settings
dialogs, text / table editors, toolbar, context menu.

## Architecture

```
src/tv/        shared drawing core, no UI and no lightweight-charts runtime:
               tool model + TradingView factory defaults (specs), hit tests,
               placement and drag rules (interact), saved-drawing migration
               (serialize), renderer-neutral scenes per tool (scene)
src/runtime/   canvas runtime: DrawingManager, scene -> canvas renderer,
               chart <-> price / time bridge (makeCoords)
```

The core is shared with [OpenTrader](https://github.com/deepentropy/opentrader),
which draws the same scenes as SVG. The package imports only types from
lightweight-charts, so the chart library is not bundled twice.

## Demo

```bash
npm run demo        # dev server, demo/
npm run build:demo  # dist-demo/ (GitHub Pages)
```

## License

MIT
