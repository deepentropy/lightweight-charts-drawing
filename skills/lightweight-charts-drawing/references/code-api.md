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
  clampToPane: false,                  // pending placement + drags stop at the pane edge (else outside presses are ignored)
});
```

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
| `setMagnet`, `setInterval`, `setStayInDrawingMode` | settings |
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
