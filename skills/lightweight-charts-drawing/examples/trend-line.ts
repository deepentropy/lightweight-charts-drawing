/*
 * Example: a trend line created, changed and removed in code.
 * Checked in CI (test/skill-examples.test.ts and `npm run typecheck`).
 */
import { defaultStyleFor, type DataPoint, type DrawingManager, type NewDrawing, type OHLC } from "lightweight-charts-drawing";

/** A support line from the low of bar `from` to the low of bar `to`, extended to the right, labelled. */
export function supportLine(bars: readonly OHLC[], from: number, to: number): NewDrawing {
  const a: DataPoint = { time: bars[from].time, price: bars[from].low };
  const b: DataPoint = { time: bars[to].time, price: bars[to].low };
  return {
    kind: "trend-line",
    points: [a, b],
    // `style` replaces the tool's default style as a whole: start from the defaults, then override.
    style: { ...defaultStyleFor("trend-line"), color: "#089981", extendRight: true, text: "Support" },
  };
}

/** Add the line to the chart; returns its id. */
export function addSupportLine(manager: DrawingManager, bars: readonly OHLC[], from: number, to: number): string {
  return manager.add(supportLine(bars, from, to));
}

/** Move the second point to the low of another bar. `update` takes the whole drawing (same id). */
export function moveSecondPoint(manager: DrawingManager, id: string, bar: OHLC): void {
  const d = manager.get(id);
  if (d?.kind !== "trend-line") return;
  manager.update({ ...d, points: [d.points[0], { time: bar.time, price: bar.low }] });
}

/** Restyle: dashed, 1px, no label. */
export function makeDashed(manager: DrawingManager, id: string): void {
  const d = manager.get(id);
  if (!d) return;
  manager.update({ ...d, style: { ...d.style, lineStyle: "dashed", width: 1, text: "" } });
}

export function removeLine(manager: DrawingManager, id: string): void {
  manager.remove(id);
}
