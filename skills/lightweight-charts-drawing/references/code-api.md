# Code API

Everything below is exported from `lightweight-charts-drawing` (`src/index.ts`). Source:
`src/runtime/manager.ts`, `src/runtime/coords.ts`, `src/core/interact/placement.ts`.

## DrawingManager

```ts
const dm = new DrawingManager(chart, series, {
  magnet: "off" | "weak" | "strong",   // OHLC snap while placing / dragging anchors
  bars: () => OHLC[],                  // bars with volume (volume profiles, VWAP); default: series data
  interval: "1D",                      // per-interval visibility of drawings; unset = all shown
  timeInfo: () => ({ timeZone: "America/New_York", intraday: true }),  // date labels
  fontFamily: "...",                   // default: the chart font
  stayInDrawingMode: false,            // keep the tool armed after a placement
  keyboard: true,                      // false: no window key listener (Escape / Delete off; pointer-event Shift / Ctrl stay)
  formatLabel: (label) => string | undefined,  // host text for every on-canvas label; see DrawingLabel
});
```

`DrawingLabel` (`src/core/labels.ts`) is a discriminated union on `id`. Each
variant carries the default `text` plus raw fields the host can reformat:

| `id` | Raw fields |
|---|---|
| `price-range` | `change`, `percent`, `pips`, `digits`, `price0`, `price1` |
| `bars-range` | `bars` |
| `time-span` | `seconds` |
| `distance` | `distancePx` |
| `angle` | `degrees` |
| `volume` | `volume` |
| `position-target` / `position-stop` | `distance`, `percent`, `ticks`, `amount`, `pnl`, `digits` |
| `position-middle` | `pnl`, `closed`, `qty`, `ratio` |
| `forecast` | `change`, `percent`, `seconds`, `digits` |
| `forecast-date` | `time`, `timeZone`, `intraday` |
| `price` | `price`, `digits` |
| `fib-level` | `coeff`, `price`, `digits` |
| `pearson` | `r` |
| `gann-ratio` | `ratio` |
| `stats-row` | `row`, `parts` (the row's piece labels) |

Every label also carries `kind` (the drawing's tool, e.g. `"trend-line"`) and `drawingId`
(the drawing's id; `"__preview__"` while the user is placing it), so a host can tell which
drawing a label belongs to.

### Composite labels

One rule: a string the library joins from **several separately hooked pieces** also reaches the
hook as one row-level `stats-row` label. The piece labels are still hooked first; `stats-row`
gets `text` (the library join of the pieces as they will draw), `row` (0-based index in the
stats box) and `parts` (the piece labels, each with the text it will draw and its own raw
fields). Return `undefined` / `null` to keep the join, a string to replace the whole row. A
string that already comes from **one label carrying every raw value it shows** stays one label.

| Drawing | String | Outcome |
|---|---|---|
| trend line family, range tools (stats box) | price row | `stats-row`, `parts` = [`price-range`] |
| trend line family, range tools | bars row ("N bars (span), distance") | `stats-row`, `parts` = [`bars-range`, `time-span`, `distance`] (those present) |
| trend line family | angle row | `stats-row`, `parts` = [`angle`] |
| range tools | volume row | `stats-row`, `parts` = [`volume`] |
| long / short position | `position-target` / `position-stop` ("Target: 30.00 (25.000%) 3,000, Amount: 1500") | one label, already carries `distance`, `percent`, `ticks`, `amount`, `pnl`, `digits` |
| long / short position | `position-middle` (PnL, qty, risk / reward on two lines) | one label, already carries `pnl`, `closed`, `qty`, `ratio` |
| position forecast | `forecast` ("30.00 (27.27%) in 20d") | one label, already carries `change`, `percent`, `seconds`, `digits` |
| position forecast | balloon price + clock + date | not a joined string: `price` and `forecast-date` are drawn as separate items |
| position forecast | `SUCCESS` / `FAILURE` banner | status text, not hooked (not in the label inventory) |

Rewriting a piece changes the join; rewriting `stats-row` replaces the join. A hook that returns
text for every `id` will also replace the rows, so return `undefined` for `stats-row` unless you
mean to.

`time-span` can arrive with an empty `text` when a hook is set (the span is zero or suppressed).
Return `undefined` to keep it empty; do not assume a non-empty default.

`dm.setFormatLabel(fn)` replaces the hook on a live manager and repaints once (for example to switch
the language); `dm.setFormatLabel(undefined)` restores the library defaults.

### Strings the hook does not reach

Text drawn on the canvas outside `formatLabel` (the hook does not reach these strings):

| String | Where | Why |
|---|---|---|
| `SUCCESS` / `FAILURE` banner | position forecast | intentional: status text, not a label |
| axis labels (price scale, time scale) | the chart | the chart's own `priceFormatter` / `localization.timeFormatter` |
| pattern vertex letters / numbers (`A B C D`, `X A B C D`, `1 2 3 …`) and ratio pills | ABCD, XABCD, Cypher, three drives, head and shoulders, triangle, Elliott, polyline / path | intentional: fixed pattern notation |
| angle arc text (`-59.04º`) | trend angle | the stats-box `angle` row is hooked, the text beside the arc is not |
| level coefficients (`0.618`, `1.618`, level numbers) | fib time zone, trend-based fib time, fib circles, fib speed fan / arcs, fib wedge, Gann fan, Gann box side labels | numbers only; `fib-level` covers fib retracement / extension / channel, and Gann square goes through `price`, `bars-range`, `gann-ratio` |
| user-typed text and the default `font-icon` glyph | text, note, callout, table, shape text, markers | author content, not generated text |

One manager per series. It attaches one series primitive and listens to pointer and key events on
the chart element. Call `dm.destroy()` before removing the chart or the series.

| Method | Notes |
|---|---|
| `add(nd)` → id | `{ id: new, style: defaultStyleFor(kind), ...nd }`: a given `style` or `id` wins. Not selected. |
| `update(d)` | replaces the drawing with the same `id` (no-op for an unknown id) |
| `remove(id)`, `clear()` | remove one / all |
| `get(id)`, `drawings()` | read; the array is the z-order (last on top) |
| `setHidden(id, bool)` | the saved `hidden` flag |
| `setDrawingsVisible(bool)` | hide / show all at once, not saved |
| `select(ids)`, `selection()` | selection |
| `bringToFront(id)`, `sendToBack(id)` | z-order |
| `toggleAnchored(id)` | text / pin / table: fix to the pane position or back to time / price |
| `setTool(kind \| null, { glyph? })`, `tool()` | arm a tool for the user (`glyph` for `font-icon`) |
| `cancelPending()` | cancels a half-placed drawing and its preview, keeps the tool armed; no-op with nothing pending |
| `setMagnet`, `setInterval`, `setStayInDrawingMode` | settings |
| `setFormatLabel(fn \| undefined)` | swap the `formatLabel` hook and repaint; `undefined` = library defaults |
| `exportJSON()`, `importJSON(json)` → count | save / load (load replaces everything, clears the selection) |
| `addImage({ name, width, height })` | image tool; the file must be in the image cache (`cacheImage` / `setImageReader`) |
| `setTableCellText`, `endTableEdit`, `tableOp`, `tableState` | table editing after `tableEdit` |
| `redraw()`, `destroy()` | |

Events (`dm.on(name, cb)` returns an unsubscribe function):

| Event | Arguments | Use |
|---|---|---|
| `change` | all drawings | persist (debounce it: it fires on every drag frame) |
| `add`, `remove` | drawing | |
| `update` | drawing, previous | undo entries |
| `gestureEnd` | | end of a drag / placement: close an undo group, save |
| `selection` | ids | |
| `tool` | kind or null | toolbar state |
| `visibility` | visible | |
| `textEdit` | drawing, pane point | open your text editor there; write back with `update({ ...d, text })` |
| `tableEdit` | drawing, cell, box | open a cell editor; `setTableCellText`, then `endTableEdit` |

User interaction is built in: clicks place the armed tool (the spec's click count); polylines,
paths and ghost feed finish on a double-click or a click on the last point; brush and highlighter
draw while the button is held. Drag anchors or the body of a selected drawing; Ctrl / Cmd click
adds to the selection, Ctrl + body drag clones. Shift constrains (45 degree steps, squares, axis
lock) and turns the magnet off; Ctrl / Cmd inverts the magnet. Escape drops pending points, then
the tool, then the selection; Delete / Backspace removes the selected unlocked drawings.
With `keyboard: false` the manager adds no key listener: no Escape cascade, no Delete / Backspace
removal. Shift and Ctrl / Cmd are read from the pointer events of a gesture (`shiftKey`, `ctrlKey` / `metaKey`), so
angle snap, axis lock, the magnet inversion, multi-select and clone keep working; the placement preview follows
the modifiers of the latest `pointermove`.

## Creating from clicks

`add` stores the points as given. To reproduce a user placement (the clicks of the tool, plus the
data computed at placement), use the placement functions with a `Coords`:

```ts
import { finishPlacement, makeCoords } from "lightweight-charts-drawing";
const coords = makeCoords(chart, series, () => bars);
const pane = chart.paneSize(0);                            // { width, height }
const nd = finishPlacement("long-position", [{ time, price }], coords, { w: pane.width, h: pane.height });
if (nd) dm.add(nd);                                        // 1 click -> entry + close point, stop / target sized
```

`buildNewDrawing(kind, clicks)` is the coords-free part (clicks to stored points only).

## Coordinate conversion

Drawings are in data space; pixels are pane coordinates (x from the left edge of the pane, after a
left price scale; y from the top of the series' pane).

```ts
const coords = makeCoords(chart, series, () => bars);
coords.timeToX(time); coords.priceToY(price);   // data -> px, null when not convertible
coords.xToTime(x);    coords.yToPrice(y);       // px -> data
coords.timeToBarIndex(time); coords.barIndexToTime(i);  // bar offsets ("10 bars later")
coords.barAt(time);                              // the bar nearest a time
```

`makeCoords` also maps times outside the loaded bars (the empty space after the last bar, by the
bar interval; pass its `getFuture` argument for a trading calendar). The chart's own
`timeScale().timeToCoordinate` returns null there. A time between two bars maps to the bar that
holds it.

From a mouse event (what the manager does):

```ts
const paneEl = series.getPane().getHTMLElement()!;
const x = e.clientX - chart.chartElement().getBoundingClientRect().left - chart.priceScale("left").width();
const y = e.clientY - paneEl.getBoundingClientRect().top;
const point = { time: coords.xToTime(x), price: coords.yToPrice(y) };  // check both for null
```

## Your own renderer

Without the manager (SVG, another canvas, server-side rendering), use the core directly:

- `sceneOf(drawing, screenPoints, { w, h, coords, selected })` returns the drawing as plain items
  (`line`, `polyline`, `polygon`, `path`, `rect`, `circle`, `ellipse`, `text`, `image`, `glyph`,
  `group`, `clip`, `clipRect`, `radialGradient`, invisible `hit` / `hitPath`, `anchors`).
  `screenPoints` = each point through `timeToX` / `priceToY` (or the `anchored` fractions times
  the pane size).
- `drawScene(ctx2d, scene, { fontFamily, anchors: { fillAt, selected } })` paints it on a canvas.
- `hitTestKind(drawing, screenPoints, cursor, w, h, coords, selected)` returns
  `{ hit: "handle", handleIndex }`, `{ hit: "body" }` or null; test drawings from the top.
- `applyDrag(state, cursor, coords, snap, shift)` returns the dragged drawing.
- `drawingAxisLabels(drawing, screenPoints, coords)` returns the price / time axis labels.
