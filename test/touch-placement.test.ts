// Touch / pen placement: later points land on release; second finger cancels unfinished work.
import { afterEach, describe, expect, it, vi } from "vitest";
import { ptr, setup } from "./pointer-harness";

afterEach(() => vi.unstubAllGlobals());

const make = (o: { dragToPlace?: boolean; stayInDrawingMode?: boolean } = { dragToPlace: true, stayInDrawingMode: true }) =>
  setup(o);

const pts = (s: ReturnType<typeof setup>) => s.dm.drawings().map((d) => d.points);

describe("touch tap-tap Trendline: point 2 on release", () => {
  it("second pointerdown places nothing; pointerup 30 px away places point 2", () => {
    const s = make();
    s.dm.setTool("trend-line");
    // First tap: point 1 on press; release without drag leaves it pending.
    s.el.dispatchEvent(ptr("pointerdown", "touch", 100, 200));
    s.doc.dispatchEvent(ptr("pointerup", "touch", 100, 200));
    expect(s.dm.drawings()).toHaveLength(0);

    // Second tap: press must not finish the line.
    s.el.dispatchEvent(ptr("pointerdown", "touch", 300, 300));
    expect(s.dm.drawings()).toHaveLength(0);
    s.doc.dispatchEvent(ptr("pointermove", "touch", 330, 300));
    s.doc.dispatchEvent(ptr("pointerup", "touch", 330, 300));
    expect(pts(s)).toEqual([[{ time: 100, price: 300 }, { time: 330, price: 200 }]]);
  });
});
