// Touch / pen gestures of TV mobile: a swipe that starts on an unselected drawing pans the chart, a tap selects it
// (#35); later points and one-point tools are placed where the finger lifts, a second finger cancels the unfinished
// drawing (#37). The mouse keeps its press behaviour.
import { afterEach, describe, expect, it, vi } from "vitest";
import { OFF, SAVED, ptr, setup, withSelectedLine } from "./pointer-harness";

afterEach(() => vi.unstubAllGlobals());

type S = ReturnType<typeof setup>;

/** An unselected trend line from (100, 200) to (300, 300); (200, 250) is on its body. */
function addLine(s: S): string {
  return s.dm.add({ kind: "trend-line", points: [{ time: 100 as never, price: 300 }, { time: 300 as never, price: 200 }] });
}

const pointsOf = (s: S) => s.dm.drawings().map((d) => d.points);

describe("#35 touch / pen press on an unselected drawing", () => {
  it.each(["touch", "pen"])("%s swipe: the chart keeps the gesture, nothing is selected or moved", (type) => {
    const s = setup();
    const id = addLine(s);
    const down = ptr("pointerdown", type, 200, 250);
    const stop = vi.spyOn(down, "stopPropagation");
    s.el.dispatchEvent(down);
    s.doc.dispatchEvent(ptr("pointermove", type, 240, 250));
    s.doc.dispatchEvent(ptr("pointerup", type, 260, 250));
    expect(stop).not.toHaveBeenCalled();
    expect(s.chart.applyOptions).not.toHaveBeenCalled();
    expect(s.el.adds.touchmove).toBeUndefined();
    expect(s.dm.selection()).toEqual([]);
    expect(s.dm.get(id)!.points).toEqual([{ time: 100, price: 300 }, { time: 300, price: 200 }]);
    expect(s.doc.liveTotal()).toBe(s.base.doc);
  });

  it.each(["touch", "pen"])("%s tap (a wobble under the tap slop): selects it at the release", (type) => {
    const s = setup();
    const id = addLine(s);
    const ends = vi.fn();
    s.dm.on("gestureEnd", ends);
    s.el.dispatchEvent(ptr("pointerdown", type, 200, 250));
    expect(s.dm.selection()).toEqual([]);
    s.doc.dispatchEvent(ptr("pointermove", type, 204, 253));
    s.doc.dispatchEvent(ptr("pointerup", type, 204, 253));
    expect(s.dm.selection()).toEqual([id]);
    expect(ends).toHaveBeenCalledTimes(1);
    expect(s.chart.applyOptions).not.toHaveBeenCalled();
    expect(s.doc.liveTotal()).toBe(s.base.doc);
  });

  it("a swipe back to the start is still a swipe", () => {
    const s = setup();
    addLine(s);
    s.el.dispatchEvent(ptr("pointerdown", "touch", 200, 250));
    s.doc.dispatchEvent(ptr("pointermove", "touch", 260, 250));
    s.doc.dispatchEvent(ptr("pointerup", "touch", 200, 250));
    expect(s.dm.selection()).toEqual([]);
  });

  it("the handle of an unselected drawing: a swipe pans, the anchor stays", () => {
    const s = setup();
    const id = addLine(s);
    s.el.dispatchEvent(ptr("pointerdown", "touch", 100, 200));
    s.doc.dispatchEvent(ptr("pointermove", "touch", 150, 230));
    s.doc.dispatchEvent(ptr("pointerup", "touch", 150, 230));
    expect(s.chart.applyOptions).not.toHaveBeenCalled();
    expect(s.dm.get(id)!.points[0]).toEqual({ time: 100, price: 300 });
  });

  it("pointercancel or a second finger: no selection", () => {
    for (const end of ["cancel", "second"] as const) {
      const s = setup();
      addLine(s);
      s.el.dispatchEvent(ptr("pointerdown", "touch", 200, 250));
      if (end === "cancel") s.doc.dispatchEvent(ptr("pointercancel", "touch", 200, 250));
      else s.el.dispatchEvent(ptr("pointerdown", "touch", 400, 100, { isPrimary: false }));
      s.doc.dispatchEvent(ptr("pointerup", "touch", 200, 250));
      expect(s.dm.selection()).toEqual([]);
      expect(s.doc.liveTotal()).toBe(s.base.doc);
      vi.unstubAllGlobals();
    }
  });

  it("a selected drawing: the touch drags its body at once", () => {
    const s = setup();
    const id = withSelectedLine(s);
    s.el.dispatchEvent(ptr("pointerdown", "touch", 200, 250));
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF]]);
    s.doc.dispatchEvent(ptr("pointermove", "touch", 220, 250));
    s.doc.dispatchEvent(ptr("pointerup", "touch", 220, 250));
    expect(s.dm.get(id)!.points).toEqual([{ time: 120, price: 300 }, { time: 320, price: 200 }]);
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED]]);
  });

  it("mouse: the press selects and holds the chart, as before", () => {
    const s = setup();
    const id = addLine(s);
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 200, 250));
    expect(s.dm.selection()).toEqual([id]);
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF]]);
    s.doc.dispatchEvent(ptr("pointerup", "mouse", 200, 250));
  });
});

describe("#37 touch / pen placement at the lift", () => {
  it.each(["touch", "pen"])("%s: point 2 of a trend line follows the finger and lands where it lifts", (type) => {
    const s = setup();
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", type, 100, 200));
    s.win.dispatchEvent(ptr("pointerup", type, 100, 200));
    s.el.dispatchEvent(ptr("pointerdown", type, 300, 300));
    expect(s.dm.drawings()).toHaveLength(0);
    s.doc.dispatchEvent(ptr("pointermove", type, 310, 305));
    s.win.dispatchEvent(ptr("pointerup", type, 320, 310));
    expect(pointsOf(s)).toEqual([[{ time: 100, price: 300 }, { time: 320, price: 190 }]]);
    expect(s.doc.liveTotal()).toBe(s.base.doc);
    expect(s.win.liveTotal()).toBe(s.base.win);
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED], [OFF], [SAVED]]);
  });

  it("a one-point tool (text): placed at the lift, then its editor is asked for", () => {
    const s = setup();
    const edit = vi.fn();
    s.dm.on("textEdit", edit);
    s.dm.setTool("text");
    s.el.dispatchEvent(ptr("pointerdown", "touch", 50, 50));
    expect(s.dm.drawings()).toHaveLength(0);
    s.doc.dispatchEvent(ptr("pointermove", "touch", 60, 70));
    s.win.dispatchEvent(ptr("pointerup", "touch", 60, 70));
    expect(pointsOf(s)).toEqual([[{ time: 60, price: 430 }]]);
    expect(edit).toHaveBeenCalledTimes(1);
  });

  it("pointercancel: nothing placed, point 1 still pending", () => {
    const s = setup();
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", "touch", 100, 200));
    s.win.dispatchEvent(ptr("pointerup", "touch", 100, 200));
    s.el.dispatchEvent(ptr("pointerdown", "touch", 300, 300));
    s.win.dispatchEvent(ptr("pointercancel", "touch", 300, 300));
    expect(s.dm.drawings()).toHaveLength(0);
    s.el.dispatchEvent(ptr("pointerdown", "touch", 300, 300));
    s.win.dispatchEvent(ptr("pointerup", "touch", 300, 300));
    expect(pointsOf(s)).toEqual([[{ time: 100, price: 300 }, { time: 300, price: 200 }]]);
  });

  it("a release outside the pane places nothing (without clampToPane)", () => {
    const s = setup();
    s.dm.setTool("horizontal-line");
    s.el.dispatchEvent(ptr("pointerdown", "touch", 100, 100));
    s.win.dispatchEvent(ptr("pointerup", "touch", 900, 100));
    expect(s.dm.drawings()).toHaveLength(0);
    expect(s.dm.tool()).toBe("horizontal-line");
  });

  it("a second finger cancels the unfinished trend line; the tool stays armed", () => {
    const s = setup();
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", "touch", 100, 200));
    s.win.dispatchEvent(ptr("pointerup", "touch", 100, 200));
    s.el.dispatchEvent(ptr("pointerdown", "touch", 300, 300, { pointerId: 1 }));
    s.el.dispatchEvent(ptr("pointerdown", "touch", 400, 100, { pointerId: 2, isPrimary: false }));
    s.win.dispatchEvent(ptr("pointerup", "touch", 300, 300, { pointerId: 1 }));
    s.win.dispatchEvent(ptr("pointerup", "touch", 400, 100, { pointerId: 2 }));
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED], [OFF], [SAVED]]);
    expect(s.dm.drawings()).toHaveLength(0);
    expect(s.dm.tool()).toBe("trend-line");
    expect(s.doc.liveTotal()).toBe(s.base.doc);
    expect(s.win.liveTotal()).toBe(s.base.win);
    // Point 1 was dropped: the next tap starts a new line.
    s.el.dispatchEvent(ptr("pointerdown", "touch", 200, 200));
    s.win.dispatchEvent(ptr("pointerup", "touch", 200, 200));
    expect(s.dm.drawings()).toHaveLength(0);
  });

  it("a second finger cancels a brush stroke; the tool stays armed", () => {
    const s = setup();
    s.dm.setTool("brush");
    s.el.dispatchEvent(ptr("pointerdown", "touch", 50, 50));
    for (const x of [80, 110]) s.doc.dispatchEvent(ptr("pointermove", "touch", x, 60));
    s.el.dispatchEvent(ptr("pointerdown", "touch", 400, 100, { isPrimary: false }));
    s.doc.dispatchEvent(ptr("pointerup", "touch", 110, 60));
    expect(s.dm.drawings()).toHaveLength(0);
    expect(s.dm.tool()).toBe("brush");
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED]]);
    expect(s.doc.liveTotal()).toBe(s.base.doc);
  });

  it("a second finger before any point: the one-point tool places nothing", () => {
    const s = setup();
    s.dm.setTool("horizontal-line");
    s.el.dispatchEvent(ptr("pointerdown", "touch", 100, 100));
    s.el.dispatchEvent(ptr("pointerdown", "touch", 300, 100, { isPrimary: false }));
    s.win.dispatchEvent(ptr("pointerup", "touch", 100, 100));
    expect(s.dm.drawings()).toHaveLength(0);
    expect(s.dm.tool()).toBe("horizontal-line");
  });

  it("mouse: point 2 is placed at the press, as before", () => {
    const s = setup();
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 100, 200));
    s.win.dispatchEvent(ptr("pointerup", "mouse", 100, 200));
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 300, 300));
    expect(pointsOf(s)).toEqual([[{ time: 100, price: 300 }, { time: 300, price: 200 }]]);
    s.win.dispatchEvent(ptr("pointerup", "mouse", 300, 300));
  });
});

describe("#39 touch: tap duration, second-finger hold, gestureEnd on cancel", () => {
  /** performance.now() under the test's control. */
  function clock() {
    let t = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => t);
    return (ms: number) => (t += ms);
  }
  afterEach(() => vi.restoreAllMocks());

  it("a hold longer than 240 ms selects nothing; a quick tap still selects", () => {
    const s = setup();
    const id = addLine(s);
    const ends = vi.fn();
    s.dm.on("gestureEnd", ends);
    const wait = clock();
    s.el.dispatchEvent(ptr("pointerdown", "touch", 200, 250));
    wait(300);
    s.doc.dispatchEvent(ptr("pointerup", "touch", 200, 250));
    expect(s.dm.selection()).toEqual([]);
    expect(ends).not.toHaveBeenCalled();
    s.el.dispatchEvent(ptr("pointerdown", "touch", 200, 250));
    wait(240);
    s.doc.dispatchEvent(ptr("pointerup", "touch", 200, 250));
    expect(s.dm.selection()).toEqual([id]);
    expect(s.doc.liveTotal()).toBe(s.base.doc);
  });

  it("tapMaxDuration: Infinity selects after any hold (0.11.0), a custom limit applies", () => {
    for (const [limit, held, selects] of [[Infinity, 5000, true], [500, 400, true], [100, 150, false]] as const) {
      const s = setup({ tapMaxDuration: limit });
      const id = addLine(s);
      const wait = clock();
      s.el.dispatchEvent(ptr("pointerdown", "pen", 200, 250));
      wait(held);
      s.doc.dispatchEvent(ptr("pointerup", "pen", 200, 250));
      expect(s.dm.selection()).toEqual(selects ? [id] : []);
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });

  it("a second finger cancels the placement; the chart stays held until both fingers lift (either order)", () => {
    for (const firstUp of [1, 2]) {
      const s = setup();
      const ends = vi.fn();
      s.dm.on("gestureEnd", ends);
      s.dm.setTool("trend-line");
      s.el.dispatchEvent(ptr("pointerdown", "touch", 100, 200, { pointerId: 1 }));
      s.el.dispatchEvent(ptr("pointerdown", "touch", 300, 200, { pointerId: 2, isPrimary: false }));
      expect(s.dm.drawings()).toHaveLength(0);
      expect(ends).toHaveBeenCalledTimes(1);
      expect(s.chart.applyOptions.mock.calls).toEqual([[OFF]]);
      expect(s.el.live("touchmove")).toBe(1);
      s.doc.dispatchEvent(ptr("pointerup", "touch", 0, 0, { pointerId: firstUp }));
      expect(s.chart.applyOptions.mock.calls).toEqual([[OFF]]);
      s.doc.dispatchEvent(ptr("pointercancel", "touch", 0, 0, { pointerId: 3 - firstUp }));
      expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED]]);
      expect(s.el.live("touchmove")).toBe(0);
      expect(s.win.liveTotal()).toBe(s.base.win);
      expect(s.doc.liveTotal()).toBe(s.base.doc);
      expect(s.dm.tool()).toBe("trend-line");
      vi.unstubAllGlobals();
    }
  });

  it("a third finger joins the hold", () => {
    const s = setup();
    s.dm.setTool("brush");
    s.el.dispatchEvent(ptr("pointerdown", "touch", 50, 50, { pointerId: 1 }));
    s.el.dispatchEvent(ptr("pointerdown", "touch", 300, 100, { pointerId: 2, isPrimary: false }));
    s.el.dispatchEvent(ptr("pointerdown", "touch", 400, 100, { pointerId: 3, isPrimary: false }));
    for (const id of [2, 1]) s.doc.dispatchEvent(ptr("pointerup", "touch", 0, 0, { pointerId: id }));
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF]]);
    s.doc.dispatchEvent(ptr("pointerup", "touch", 0, 0, { pointerId: 3 }));
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED]]);
    expect(s.dm.drawings()).toHaveLength(0);
  });

  it("secondFingerPinch: the chart gets pan and pinch back at the second finger (0.11.0)", () => {
    const s = setup({ secondFingerPinch: true });
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", "touch", 100, 200, { pointerId: 1 }));
    s.el.dispatchEvent(ptr("pointerdown", "touch", 300, 200, { pointerId: 2, isPrimary: false }));
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED]]);
    expect(s.el.live("touchmove")).toBe(0);
    expect(s.win.liveTotal()).toBe(s.base.win);
  });

  it("a drag of a selected drawing: a second finger keeps the chart held past the first lift", () => {
    const s = setup();
    const id = withSelectedLine(s);
    s.el.dispatchEvent(ptr("pointerdown", "touch", 200, 250, { pointerId: 1 }));
    s.doc.dispatchEvent(ptr("pointermove", "touch", 220, 250, { pointerId: 1 }));
    s.el.dispatchEvent(ptr("pointerdown", "touch", 400, 100, { pointerId: 2, isPrimary: false }));
    s.doc.dispatchEvent(ptr("pointerup", "touch", 220, 250, { pointerId: 1 }));
    expect(s.dm.get(id)!.points).toEqual([{ time: 120, price: 300 }, { time: 320, price: 200 }]);
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF]]);
    s.doc.dispatchEvent(ptr("pointerup", "touch", 400, 100, { pointerId: 2 }));
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED]]);
  });

  it("a first finger after a missed lift: the stale hold is given back", () => {
    const s = setup();
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", "touch", 100, 200, { pointerId: 1 }));
    s.el.dispatchEvent(ptr("pointerdown", "touch", 300, 200, { pointerId: 2, isPrimary: false }));
    s.doc.dispatchEvent(ptr("pointerup", "touch", 0, 0, { pointerId: 1 }));
    // Finger 2's lift never arrives.
    s.el.dispatchEvent(ptr("pointerdown", "touch", 100, 200, { pointerId: 3 }));
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED], [OFF]]);
    s.win.dispatchEvent(ptr("pointerup", "touch", 100, 200, { pointerId: 3 }));
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED], [OFF], [SAVED]]);
  });

  it("gestureEnd: a cancelled one-point press and Escape on pending points; not while a point stays pending", () => {
    const s = setup();
    const ends = vi.fn();
    s.dm.on("gestureEnd", ends);
    s.dm.setTool("horizontal-line");
    s.el.dispatchEvent(ptr("pointerdown", "touch", 100, 100));
    s.win.dispatchEvent(ptr("pointercancel", "touch", 100, 100));
    expect(ends).toHaveBeenCalledTimes(1);
    s.el.dispatchEvent(ptr("pointerdown", "touch", 100, 100));
    s.win.dispatchEvent(ptr("pointerup", "touch", 900, 100));
    expect(ends).toHaveBeenCalledTimes(2);
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", "touch", 100, 200));
    s.win.dispatchEvent(ptr("pointerup", "touch", 100, 200));
    s.el.dispatchEvent(ptr("pointerdown", "touch", 300, 300));
    s.win.dispatchEvent(ptr("pointercancel", "touch", 300, 300));
    expect(ends).toHaveBeenCalledTimes(2);
    s.win.dispatchEvent(Object.assign(new Event("keydown"), { key: "Escape" }));
    expect(ends).toHaveBeenCalledTimes(3);
    expect(s.dm.drawings()).toHaveLength(0);
  });

  it("touchHitTolerance is the whole slop: 22 reaches a tap 18 px from a line, 16 does not", () => {
    for (const [tol, hits] of [[22, true], [16, false]] as const) {
      const s = setup({ touchHitTolerance: tol });
      const id = s.dm.add({ kind: "trend-line", points: [{ time: 100 as never, price: 300 }, { time: 300 as never, price: 300 }] });
      s.el.dispatchEvent(ptr("pointerdown", "touch", 200, 218));
      s.doc.dispatchEvent(ptr("pointerup", "touch", 200, 218));
      expect(s.dm.selection()).toEqual(hits ? [id] : []);
      vi.unstubAllGlobals();
    }
  });
});
