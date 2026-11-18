// Characterization of 0.10.1 mouse placement (click-click, one-point, dragToPlace, non-primary).
// Written on unmodified upstream/main and never edited after — the touch release-placement path must keep this green.
import { afterEach, describe, expect, it, vi } from "vitest";
import { OFF, SAVED, ptr, setup } from "./pointer-harness";

afterEach(() => vi.unstubAllGlobals());

const make = () => setup({ dragToPlace: true });

const pts = (s: ReturnType<typeof setup>) => s.dm.drawings().map((d) => d.points);

describe("mouse placement, as in 0.10.1", () => {
  it("click-click Trendline places point 2 at the second press", () => {
    const s = make();
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 100, 200));
    s.win.dispatchEvent(ptr("pointerup", "mouse", 100, 200));
    expect(s.dm.drawings()).toHaveLength(0);
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 300, 300));
    expect(pts(s)).toEqual([[{ time: 100, price: 300 }, { time: 300, price: 200 }]]);
    s.win.dispatchEvent(ptr("pointerup", "mouse", 300, 300));
  });

  it("press on Horizontal line places at press", () => {
    const s = make();
    s.dm.setTool("horizontal-line");
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 100, 200));
    expect(s.dm.drawings()).toHaveLength(1);
    expect(pts(s)).toEqual([[{ time: 100, price: 300 }]]);
    s.win.dispatchEvent(ptr("pointerup", "mouse", 100, 200));
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED]]);
  });

  it("dragToPlace: press, move 40 px, release places the line", () => {
    const s = make();
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 100, 200));
    s.doc.dispatchEvent(ptr("pointermove", "mouse", 140, 200));
    s.doc.dispatchEvent(ptr("pointerup", "mouse", 140, 200));
    expect(pts(s)).toEqual([[{ time: 100, price: 300 }, { time: 140, price: 300 }]]);
  });

  it("a mouse press with isPrimary false and a tool armed still places", () => {
    const s = make();
    s.dm.setTool("horizontal-line");
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 100, 200, { isPrimary: false }));
    expect(s.dm.drawings()).toHaveLength(1);
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF]]);
  });
});
