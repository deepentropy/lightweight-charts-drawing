// Touch / pen placement: later points land on release; second finger cancels unfinished work.
import { afterEach, describe, expect, it, vi } from "vitest";
import { OFF, SAVED, ptr, setup } from "./pointer-harness";

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

describe("second finger cancels a touch placement or stroke", () => {
  it("dragToPlace live: second touch cancels; chart restores after both ups; tool stays", () => {
    const s = make();
    const tool = vi.fn();
    const gestureEnd = vi.fn();
    s.dm.on("tool", tool);
    s.dm.on("gestureEnd", gestureEnd);
    tool.mockClear();
    s.dm.setTool("trend-line");
    tool.mockClear();

    s.el.dispatchEvent(ptr("pointerdown", "touch", 100, 200));
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF]]);
    s.el.dispatchEvent(ptr("pointerdown", "touch", 200, 250, { isPrimary: false }));

    expect(s.dm.drawings()).toHaveLength(0);
    expect(s.dm.tool()).toBe("trend-line");
    expect(tool).not.toHaveBeenCalled();
    expect(gestureEnd).toHaveBeenCalledTimes(1);
    // Still held after the cancel.
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF]]);

    s.doc.dispatchEvent(ptr("pointerup", "touch", 100, 200));
    expect(s.dm.drawings()).toHaveLength(0);
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF]]);
    s.doc.dispatchEvent(ptr("pointerup", "touch", 200, 250, { isPrimary: false }));
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED]]);
    expect(s.dm.tool()).toBe("trend-line");
  });

  it("tap-tap: second finger while placing point 2 leaves nothing and keeps the tool", () => {
    const s = make();
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", "touch", 100, 200));
    s.doc.dispatchEvent(ptr("pointerup", "touch", 100, 200));
    s.el.dispatchEvent(ptr("pointerdown", "touch", 300, 300));
    s.el.dispatchEvent(ptr("pointerdown", "touch", 350, 320, { isPrimary: false }));
    s.doc.dispatchEvent(ptr("pointerup", "touch", 300, 300));
    s.doc.dispatchEvent(ptr("pointerup", "touch", 350, 320, { isPrimary: false }));
    expect(s.dm.drawings()).toHaveLength(0);
    expect(s.dm.tool()).toBe("trend-line");
  });

  it("Brush stroke + second touch: no drawing, tool armed, one gestureEnd", () => {
    const s = make();
    const gestureEnd = vi.fn();
    const tool = vi.fn();
    s.dm.on("gestureEnd", gestureEnd);
    s.dm.on("tool", tool);
    s.dm.setTool("brush");
    tool.mockClear();
    s.el.dispatchEvent(ptr("pointerdown", "touch", 50, 50));
    for (const x of [80, 110, 140]) s.doc.dispatchEvent(ptr("pointermove", "touch", x, 50 + x / 2));
    s.el.dispatchEvent(ptr("pointerdown", "touch", 200, 100, { isPrimary: false }));
    s.doc.dispatchEvent(ptr("pointerup", "touch", 140, 120));
    s.doc.dispatchEvent(ptr("pointerup", "touch", 200, 100, { isPrimary: false }));
    expect(s.dm.drawings()).toHaveLength(0);
    expect(s.dm.tool()).toBe("brush");
    expect(tool).not.toHaveBeenCalled();
    expect(gestureEnd).toHaveBeenCalledTimes(1);
  });

  it("second touch with no tool and nothing pending is ignored", () => {
    const s = make();
    s.el.dispatchEvent(ptr("pointerdown", "touch", 50, 50, { isPrimary: false }));
    expect(s.chart.applyOptions).not.toHaveBeenCalled();
  });

  it("after a cancel, the next single tap starts a new drawing", () => {
    const s = make();
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", "touch", 100, 200));
    s.el.dispatchEvent(ptr("pointerdown", "touch", 200, 250, { isPrimary: false }));
    s.doc.dispatchEvent(ptr("pointerup", "touch", 100, 200));
    s.doc.dispatchEvent(ptr("pointerup", "touch", 200, 250, { isPrimary: false }));
    expect(s.dm.drawings()).toHaveLength(0);

    s.el.dispatchEvent(ptr("pointerdown", "touch", 120, 220));
    s.doc.dispatchEvent(ptr("pointerup", "touch", 120, 220));
    expect(s.dm.drawings()).toHaveLength(0);
    // Point 1 pending: finish with a second tap on release.
    s.el.dispatchEvent(ptr("pointerdown", "touch", 300, 300));
    s.doc.dispatchEvent(ptr("pointerup", "touch", 300, 300));
    expect(pts(s)).toEqual([[{ time: 120, price: 280 }, { time: 300, price: 200 }]]);
  });
});
