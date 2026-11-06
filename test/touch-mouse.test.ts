// Characterization of the 0.6.3 pointer gestures, written on unmodified 0.6.3 and never edited after:
// the mouse path (handle drag, armed-tool placement) and a touch on an empty chart. The touch fix must keep
// all of it as is.
import { afterEach, describe, expect, it, vi } from "vitest";
import { OFF, SAVED, ptr, setup, withSelectedLine } from "./pointer-harness";

afterEach(() => vi.unstubAllGlobals());

describe("mouse, as in 0.6.3", () => {
  // isPrimary of a synthetic mouse event may be true, false or missing: all stay on the same path.
  it.each([{ isPrimary: true }, { isPrimary: false }, { isPrimary: undefined }])("handle drag: exact applyOptions calls and listener counts (%o)", (extra) => {
    const s = setup();
    withSelectedLine(s);
    const down = ptr("pointerdown", "mouse", 100, 200, extra);
    const stop = vi.spyOn(down, "stopPropagation");
    s.el.dispatchEvent(down);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF]]);
    expect(s.doc.live("pointermove")).toBe(1);
    expect(s.doc.live("pointerup")).toBe(1);
    expect(s.el.live("touchmove")).toBe(0);

    s.doc.dispatchEvent(ptr("pointermove", "mouse", 150, 250, extra));
    s.doc.dispatchEvent(ptr("pointerup", "mouse", 150, 250, extra));
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED]]);
    expect(s.doc.liveTotal()).toBe(s.base.doc);
    // pointermove / pointerup counts only: a release listener for pointercancel is not part of the mouse contract.
    expect([s.doc.adds.pointermove, s.doc.adds.pointerup]).toEqual([1, 1]);
    expect([s.doc.removes.pointermove, s.doc.removes.pointerup]).toEqual([1, 1]);
    expect(s.el.adds.touchmove).toBeUndefined();
  });

  it("armed tool: first click holds the chart until the window pointerup", () => {
    const s = setup();
    s.dm.setTool("trend-line");
    const down = ptr("pointerdown", "mouse", 50, 50);
    const stop = vi.spyOn(down, "stopPropagation");
    s.el.dispatchEvent(down);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF]]);
    expect(s.win.live("pointerup")).toBe(1);
    expect(s.el.live("touchmove")).toBe(0);

    s.win.dispatchEvent(ptr("pointerup", "mouse", 50, 50));
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED]]);
    expect(s.win.liveTotal()).toBe(s.base.win);
  });
});

describe("touch on an empty chart, as in 0.6.3", () => {
  it("a touch press off every drawing, no tool: nothing is taken", () => {
    const s = setup();
    withSelectedLine(s);
    const down = ptr("pointerdown", "touch", 600, 100);
    const stop = vi.spyOn(down, "stopPropagation");
    const prevent = vi.spyOn(down, "preventDefault");
    s.el.dispatchEvent(down);
    s.el.dispatchEvent(ptr("pointermove", "touch", 560, 120));
    s.doc.dispatchEvent(ptr("pointerup", "touch", 560, 120));
    expect(s.chart.applyOptions).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
    expect(prevent).not.toHaveBeenCalled();
    expect(s.doc.liveTotal()).toBe(s.base.doc);
    expect(s.win.liveTotal()).toBe(s.base.win);
    expect(s.dm.selection()).toEqual([]);
  });
});
