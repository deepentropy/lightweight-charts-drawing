// A pane added in the same frame exists in the chart model before its widget does, and
// `chart.paneSize(i)` throws for it (lightweight-charts `ensureDefined`). The manager must not
// throw from the primitive's view update or from a pointer press in that window.
import { afterEach, describe, expect, it, vi } from "vitest";
import { ptr, setup, withSelectedLine } from "./pointer-harness";

afterEach(() => vi.unstubAllGlobals());

function paneNotReady(s: ReturnType<typeof setup>): void {
  (s.chart as { paneSize: () => unknown }).paneSize = () => {
    throw new Error("Value is undefined");
  };
}

describe("pane widget not created yet", () => {
  it("axis views do not throw and show nothing", () => {
    const s = setup();
    withSelectedLine(s);
    (s.dm as unknown as { series: { priceFormatter(): { format(p: number): string } } }).series.priceFormatter = () => ({ format: (p) => String(p) });
    paneNotReady(s);
    let views: ReturnType<typeof s.dm.axisViews> | undefined;
    expect(() => (views = s.dm.axisViews())).not.toThrow();
    expect(views).toBeDefined();
  });

  it("a press over a drawing does not throw and hits nothing", () => {
    const s = setup();
    const id = withSelectedLine(s);
    s.dm.select([]);
    paneNotReady(s);
    expect(() => s.el.dispatchEvent(ptr("pointerdown", "mouse", 200, 250))).not.toThrow();
    s.win.dispatchEvent(ptr("pointerup", "mouse", 200, 250));
    expect(s.dm.selection()).not.toContain(id);
  });
});
