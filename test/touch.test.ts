// Touch and pen gestures: a held gesture ends on pointercancel as well as on pointerup, so the chart gets its
// pan / zoom back; touchmove is kept for a touch drag; a second finger is left to the chart.
import { afterEach, describe, expect, it, vi } from "vitest";
import { OFF, SAVED, ev, ptr, setup, withSelectedLine } from "./pointer-harness";

afterEach(() => vi.unstubAllGlobals());

describe("a handle drag cancelled by the browser", () => {
  it.each(["touch", "pen"])("%s: pointercancel gives the chart back", (type) => {
    const s = setup();
    withSelectedLine(s);
    s.el.dispatchEvent(ptr("pointerdown", type, 100, 200));
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF]]);
    s.doc.dispatchEvent(ptr("pointermove", type, 120, 220));
    s.doc.dispatchEvent(ptr("pointercancel", type, 120, 220));
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED]]);
    expect(s.doc.liveTotal()).toBe(s.base.doc);
  });
});

describe("every other hold site releases on pointercancel", () => {
  it("armed tool: placement press", () => {
    const s = setup();
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", "touch", 50, 50));
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF]]);
    s.win.dispatchEvent(ptr("pointercancel", "touch", 50, 50));
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED]]);
    expect(s.win.liveTotal()).toBe(s.base.win);
  });

  it("locked drawing: press", () => {
    const s = setup();
    const id = withSelectedLine(s);
    s.dm.update({ ...s.dm.get(id)!, locked: true } as never);
    s.el.dispatchEvent(ptr("pointerdown", "touch", 100, 200));
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF]]);
    s.win.dispatchEvent(ptr("pointercancel", "touch", 100, 200));
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED]]);
    expect(s.win.liveTotal()).toBe(s.base.win);
  });

  it("brush: the cancelled stroke is discarded, a lifted one is committed", () => {
    const stroke = (end: string) => {
      const s = setup();
      s.dm.setTool("brush");
      s.el.dispatchEvent(ptr("pointerdown", "touch", 50, 50));
      for (const x of [80, 110, 140]) s.doc.dispatchEvent(ptr("pointermove", "touch", x, 50 + x / 2));
      s.doc.dispatchEvent(ptr(end, "touch", 140, 120));
      expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED]]);
      expect(s.doc.liveTotal()).toBe(s.base.doc);
      return s.dm.drawings().length;
    };
    expect(stroke("pointercancel")).toBe(0);
    vi.unstubAllGlobals();
    expect(stroke("pointerup")).toBe(1);
  });
});

describe("touchmove during a touch hold", () => {
  const moveOnChart = (s: ReturnType<typeof setup>) => {
    const m = ev("touchmove");
    s.el.dispatchEvent(m);
    return m.defaultPrevented;
  };

  it.each(["touch", "pen"])("%s: handle press: non-passive guard until the release", (type) => {
    const s = setup();
    withSelectedLine(s);
    const add = vi.spyOn(s.el, "addEventListener");
    s.el.dispatchEvent(ptr("pointerdown", type, 100, 200));
    expect(add).toHaveBeenCalledWith("touchmove", expect.any(Function), { passive: false });
    expect(moveOnChart(s)).toBe(true);
    s.doc.dispatchEvent(ptr("pointerup", type, 100, 200));
    expect(moveOnChart(s)).toBe(false);
    expect(s.el.live("touchmove")).toBe(0);
  });

  it("armed tool: guard until the release", () => {
    const s = setup();
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", "touch", 50, 50));
    expect(moveOnChart(s)).toBe(true);
    s.win.dispatchEvent(ptr("pointercancel", "touch", 50, 50));
    expect(moveOnChart(s)).toBe(false);
  });

  it("mouse hold: no touchmove listener at all", () => {
    const s = setup();
    withSelectedLine(s);
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 100, 200));
    expect(s.el.adds.touchmove).toBeUndefined();
    expect(moveOnChart(s)).toBe(false);
  });
});

describe("a second finger", () => {
  it.each(["touch", "pen"])("%s with isPrimary false is ignored", (type) => {
    const s = setup();
    s.dm.setTool("trend-line");
    const down = ptr("pointerdown", type, 50, 50, { isPrimary: false });
    const stop = vi.spyOn(down, "stopPropagation");
    s.el.dispatchEvent(down);
    expect(stop).not.toHaveBeenCalled();
    expect(s.chart.applyOptions).not.toHaveBeenCalled();
    expect(s.win.liveTotal()).toBe(s.base.win);
  });

  it("a mouse event with isPrimary false stays on the 0.6.3 path", () => {
    const s = setup();
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 50, 50, { isPrimary: false }));
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF]]);
  });
});

describe("destroy in the middle of a touch gesture", () => {
  it("leaves no window / document / chart listener behind", () => {
    const s = setup();
    withSelectedLine(s);
    s.el.dispatchEvent(ptr("pointerdown", "touch", 100, 200));
    s.dm.destroy();
    expect(s.doc.liveTotal()).toBe(0);
    expect(s.win.liveTotal()).toBe(0);
    expect(s.el.liveTotal()).toBe(0);
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED]]);
  });

  it("armed tool press", () => {
    const s = setup();
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", "touch", 50, 50));
    s.dm.destroy();
    expect(s.win.liveTotal()).toBe(0);
    expect(s.el.liveTotal()).toBe(0);
  });
});
