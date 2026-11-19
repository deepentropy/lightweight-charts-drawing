// touchHitTolerance (#33): a wider hit slop for touch and pen presses, the mouse unchanged.
import { afterEach, describe, expect, it, vi } from "vitest";
import { hitTestKind } from "../src";
import { ptr, setup, withSelectedLine } from "./pointer-harness";

afterEach(() => vi.unstubAllGlobals());

/** A trend line from (100, 200) to (300, 300); this point is 14 px off its middle. */
const OFF_LINE = { x: 200 - 0.4472 * 14, y: 250 + 0.8944 * 14 };

function addLine(s: ReturnType<typeof setup>): string {
  return s.dm.add({ kind: "trend-line", points: [{ time: 100 as never, price: 300 }, { time: 300 as never, price: 200 }] });
}

function tap(s: ReturnType<typeof setup>, type: string, x: number, y: number): void {
  s.el.dispatchEvent(ptr("pointerdown", type, x, y));
  s.doc.dispatchEvent(ptr("pointerup", type, x, y));
}

describe("a press 14 px off a trend line", () => {
  it.each(["touch", "pen"])("%s with touchHitTolerance 16: selects it", (type) => {
    const s = setup({ touchHitTolerance: 16 });
    const id = addLine(s);
    tap(s, type, OFF_LINE.x, OFF_LINE.y);
    expect(s.dm.selection()).toEqual([id]);
  });

  it("touch without the option: misses it (the chart pans)", () => {
    const s = setup();
    addLine(s);
    tap(s, "touch", OFF_LINE.x, OFF_LINE.y);
    expect(s.dm.selection()).toEqual([]);
    expect(s.chart.applyOptions).not.toHaveBeenCalled();
  });

  it("mouse with the option: misses it", () => {
    const s = setup({ touchHitTolerance: 16 });
    addLine(s);
    tap(s, "mouse", OFF_LINE.x, OFF_LINE.y);
    expect(s.dm.selection()).toEqual([]);
  });

  it("setTouchHitTolerance turns it on and off", () => {
    const s = setup();
    const id = addLine(s);
    s.dm.setTouchHitTolerance(16);
    tap(s, "touch", OFF_LINE.x, OFF_LINE.y);
    expect(s.dm.selection()).toEqual([id]);
    s.dm.select([]);
    s.dm.setTouchHitTolerance(undefined);
    tap(s, "touch", OFF_LINE.x, OFF_LINE.y);
    expect(s.dm.selection()).toEqual([]);
  });
});

describe("a touch 15 px from a handle", () => {
  // (115, 200) is 15 px from anchor 0 and 6.7 px from the line: past the mouse handle radius (12) and stroke slop (6).
  const drag = (opts: { touchHitTolerance?: number }) => {
    const s = setup(opts);
    const id = withSelectedLine(s);
    s.el.dispatchEvent(ptr("pointerdown", "touch", 115, 200));
    s.doc.dispatchEvent(ptr("pointermove", "touch", 165, 150));
    s.doc.dispatchEvent(ptr("pointerup", "touch", 165, 150));
    return s.dm.get(id)!.points;
  };

  it("with the option: drags the handle, the other anchor stays", () => {
    const [p0, p1] = drag({ touchHitTolerance: 16 });
    expect(p0).not.toEqual({ time: 100, price: 300 });
    expect(p1).toEqual({ time: 300, price: 200 });
  });

  it("without it: nothing moves", () => {
    expect(drag({})).toEqual([{ time: 100, price: 300 }, { time: 300, price: 200 }]);
  });
});

describe("the drawing under the finger wins over a nearer-to-top one", () => {
  it("a touch 1 px from the lower line picks it, not the line on top 15 px away", () => {
    const s = setup({ touchHitTolerance: 16 });
    const under = s.dm.add({ kind: "horizontal-line", points: [{ time: 100 as never, price: 300 }] });
    const top = s.dm.add({ kind: "horizontal-line", points: [{ time: 100 as never, price: 284 }] });
    tap(s, "touch", 300, 201);
    expect(s.dm.selection()).toEqual([under]);
    s.dm.select([]);
    // Off both by more than the mouse slop: the wide slop reaches the topmost one in range.
    tap(s, "touch", 300, 207.5);
    expect(s.dm.selection()).toEqual([top]);
  });
});

describe("hitTestKind tolerance", () => {
  const drawingOf = (s: ReturnType<typeof setup>, id: string) => s.dm.get(id)!;

  it("a short line: the nearest handle, not the first in range", () => {
    const s = setup();
    const id = s.dm.add({ kind: "trend-line", points: [{ time: 100 as never, price: 400 }, { time: 110 as never, price: 400 }] });
    const pts = [{ x: 100, y: 100 }, { x: 110, y: 100 }];
    expect(hitTestKind(drawingOf(s, id), pts, { x: 109, y: 100 }, 800, 500, null)).toEqual({ hit: "handle", handleIndex: 1 });
    expect(hitTestKind(drawingOf(s, id), pts, { x: 101, y: 100 }, 800, 500, null, false, 20)).toEqual({ hit: "handle", handleIndex: 0 });
    expect(hitTestKind(drawingOf(s, id), pts, { x: 125, y: 100 }, 800, 500, null, false, 20)).toEqual({ hit: "handle", handleIndex: 1 });
  });

  it("a rectangle border 14 px away: missed with the mouse slop, hit with 16", () => {
    const s = setup();
    const r = s.dm.add({ kind: "rectangle", points: [{ time: 100 as never, price: 400 }, { time: 300 as never, price: 300 }] });
    const d = drawingOf(s, r);
    const pts = [{ x: 100, y: 100 }, { x: 300, y: 200 }];
    // Below the bottom edge, off the edge midpoint (handle 6 at (200, 200)).
    const c = { x: 260, y: 214 };
    expect(hitTestKind(d, pts, c, 800, 500, null)).toBeNull();
    expect(hitTestKind(d, pts, c, 800, 500, null, false, 16)).toEqual({ hit: "body" });
  });

  it("a brush end 18 px away: grabbed with 16 (handle radius 6 + 16)", () => {
    const s = setup();
    const b = s.dm.add({ kind: "brush", points: [100, 120, 140, 160].map((x) => ({ time: x as never, price: 400 })) } as never);
    const d = drawingOf(s, b);
    const pts = [100, 120, 140, 160].map((x) => ({ x, y: 100 }));
    const c = { x: 178, y: 100 };
    expect(hitTestKind(d, pts, c, 800, 500, null)).toBeNull();
    expect(hitTestKind(d, pts, c, 800, 500, null, false, 16)).toEqual({ hit: "handle", handleIndex: 3 });
  });

  it("a tolerance under the mouse slop changes nothing", () => {
    const s = setup();
    const id = addLine(s);
    const pts = [{ x: 100, y: 200 }, { x: 300, y: 300 }];
    const c = { x: 200 - 0.4472 * 5, y: 250 + 0.8944 * 5 };
    expect(hitTestKind(drawingOf(s, id), pts, c, 800, 500, null, false, 1)).toEqual({ hit: "body" });
  });
});
