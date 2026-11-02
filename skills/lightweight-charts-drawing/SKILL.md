---
name: lightweight-charts-drawing
description: Create, change, remove, save and load chart drawings (trend lines, Fibonacci tools, channels, pitchforks, shapes, text notes, positions, volume profiles...) with the lightweight-charts-drawing library on lightweight-charts v5, and add or change drawing tools inside the library. Use when code imports lightweight-charts-drawing, when drawings must be built or edited in code, when saved drawings are read or written, or when a drawing tool is implemented or fixed.
---

# lightweight-charts-drawing

Drawing tools for lightweight-charts v5. One `DrawingManager` per series draws every drawing,
handles the mouse and keys, and emits events. The drawing core (`src/core`) is UI-free and is also
used directly by the OpenTrader app, which renders the same scenes as SVG.

This guide ships with the package: `node_modules/lightweight-charts-drawing/skills/lightweight-charts-drawing/`
matches the installed version. Read the reference files below before writing code.

## Workflow

**Using drawings in an app**

1. Find the tool's `kind` and its number of stored points in [references/tools.md](references/tools.md).
2. Build a `NewDrawing`: `kind`, `points` in data space (`{ time, price }`), and a style that starts
   from `defaultStyleFor(kind)` (see [references/drawing-model.md](references/drawing-model.md)).
3. `manager.add(drawing)` returns the id. Change it with `manager.update({ ...d, ... })`, delete it
   with `manager.remove(id)` ([references/code-api.md](references/code-api.md)).
4. Save `manager.exportJSON()`; load with `manager.importJSON(json)` (or `parseDrawings` when you hold
   the array yourself).
5. Copy the closest example from [examples/](examples/) and adapt it.

**Changing the library**

1. Read the tool's existing code paths first (spec, placement, scene, hit test, drag); the checklist
   is in [references/new-tool.md](references/new-tool.md). Copy what a similar tool does.
2. Add a test under `test/` (vitest, the mock `Coords` of `test/skill-examples.test.ts`).
3. Run `npm run typecheck`, `npm test`, `npm run build`. After a spec change, regenerate
   `references/tools.md` with `npx vitest run -u` and `docs/TOOLS.md` with `python docs/tools_md.py`.

## Rules

- **Points are data, not pixels.** Each point is `{ time, price }` where `time` is a bar time in the
  same `Time` format as the series data (UTC seconds, business-day string or object). A time between
  two bars is drawn on the bar that holds it; a time after the last bar is drawn in the future.
- **Point count is per tool and is not always the click count.** `long-position` is placed with 1
  click and stores 2 points, `curve` 2 clicks and 3 points, `double-curve` 2 clicks and 4 points.
  Give `add` exactly the stored count (column "Points" of `references/tools.md`). The types enforce
  it: `points` is a tuple per `kind`.
- **`style` replaces the defaults, it does not merge.** `add` uses `defaultStyleFor(kind)` only when
  `style` is missing. Write `style: { ...defaultStyleFor(kind), color: "#f23645" }`, never a partial
  style.
- **Text lives in `drawing.text`** for the text tools (`text`, `note`, `pin`, `comment`,
  `price-note`, `signpost`, `callout`). `style.text` is the label drawn on line tools.
- **Never mutate a drawing.** Build a new object and call `update` with the same `id`; the manager
  replaces it, redraws and emits `update` / `change`.
- **Load through `parseDrawings` / `importJSON`.** They drop invalid entries and migrate old point
  models (`fmt`). Never cast raw JSON to `Drawing[]`.
- **Copy before editing levels.** `defaultStyleFor` returns a fresh copy of the level ladder;
  on an existing drawing, build a new array (`style.levels.map(...)`) rather than editing it.
- **The library has no UI.** Text editor, settings dialog, undo stack, toolbar, context menu and
  storage belong to the host. Listen to `textEdit`, `tableEdit`, `gestureEnd` and `change`.
- **Pixels only where documented.** A few fields are screen values on purpose (`anchored` pane
  fractions, image size, table sizes, `wordWrapWidth`, the trend angle); everything else is data.
- **Use the tool's own model.** For a Fibonacci retracement, level 0 is on the second point and
  level 1 on the first; a circle is centre + radius point; a parallel channel's third point holds
  the offset at the first point's time. See the point models in `references/drawing-model.md`.

## Quick start

```ts
import { createChart, CandlestickSeries } from "lightweight-charts";
import { DrawingManager, defaultStyleFor } from "lightweight-charts-drawing";

const chart = createChart(el, { autoSize: true });
const series = chart.addSeries(CandlestickSeries);
series.setData(bars);
const drawings = new DrawingManager(chart, series, { magnet: "weak" });

const id = drawings.add({
  kind: "trend-line",
  points: [
    { time: bars[10].time, price: bars[10].low },
    { time: bars[40].time, price: bars[40].high },
  ],
  style: { ...defaultStyleFor("trend-line"), color: "#089981" },
});
drawings.setTool("fib-retracement"); // or let the user place one
localStorage.setItem("drawings", drawings.exportJSON());
```

## Examples (run in CI by `test/skill-examples.test.ts`)

- [examples/trend-line.ts](examples/trend-line.ts): build, add, move a point, restyle, remove.
- [examples/fib-retracement.ts](examples/fib-retracement.ts): retracement over a swing, chosen
  levels, level prices.
- [examples/text-note.ts](examples/text-note.ts): a note anchored to a bar, text editing through
  the `textEdit` event.

## References

- [references/drawing-model.md](references/drawing-model.md): `Drawing` / `NewDrawing`, style
  fields, point model per tool family, the saved format and its migration.
- [references/code-api.md](references/code-api.md): `DrawingManager` methods and events, creating
  from clicks, coordinate conversion, drawing with your own renderer.
- [references/tools.md](references/tools.md): every tool's `kind`, placement, stored points and
  default style (generated from the specs).
- [references/new-tool.md](references/new-tool.md): adding or changing a tool: file layout, spec,
  placement, scene, hit test, drag, keys, tests.
- Tool names and toolbar groups: `docs/TOOLS.md` in the repository.
