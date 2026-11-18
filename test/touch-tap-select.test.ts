// Touch / pen tap-select on release: a swipe on an unselected drawing pans the chart; a short tap selects.
import { afterEach, describe, expect, it, vi } from "vitest";
import { ptr, setup } from "./pointer-harness";

afterEach(() => vi.unstubAllGlobals());

/** Unselected trend line with anchors at pixels (100, 200) and (300, 300); body mid ≈ (200, 250). */
function withUnselectedLine(s: ReturnType<typeof setup>): string {
  return s.dm.add({ kind: "trend-line", points: [{ time: 100 as never, price: 300 }, { time: 300 as never, price: 200 }] });
}

function pointsOf(s: ReturnType<typeof setup>, id: string) {
  return s.dm.get(id)!.points.map((p) => ({ time: p.time, price: p.price }));
}

/** Event.timeStamp is a getter — set it after the harness builds the event. */
function ptrAt(type: string, pointerType: string, x: number, y: number, timeStamp: number, extra: Record<string, unknown> = {}): Event {
  const e = ptr(type, pointerType, x, y, extra);
  Object.defineProperty(e, "timeStamp", { value: timeStamp, configurable: true });
  return e;
}

describe("touch tap-select on an unselected drawing", () => {
  it("press does not select or hold; a still release at 100 ms selects", () => {
    const s = setup();
    const id = withUnselectedLine(s);
    const down = ptrAt("pointerdown", "touch", 200, 250, 1000);
    const stop = vi.spyOn(down, "stopPropagation");
    s.el.dispatchEvent(down);
    expect(stop).not.toHaveBeenCalled();
    expect(s.chart.applyOptions).not.toHaveBeenCalled();
    expect(s.dm.selection()).toEqual([]);

    s.doc.dispatchEvent(ptrAt("pointerup", "touch", 200, 250, 1100));
    expect(s.dm.selection()).toEqual([id]);
    expect(s.chart.applyOptions).not.toHaveBeenCalled();
  });

  it("a 40 px swipe leaves selection empty, points unchanged, and never holds the chart", () => {
    const s = setup();
    const id = withUnselectedLine(s);
    const before = pointsOf(s, id);
    const down = ptrAt("pointerdown", "touch", 200, 250, 1000);
    const stop = vi.spyOn(down, "stopPropagation");
    s.el.dispatchEvent(down);
    s.doc.dispatchEvent(ptrAt("pointermove", "touch", 240, 250, 1050));
    s.doc.dispatchEvent(ptrAt("pointerup", "touch", 240, 250, 1100));
    expect(stop).not.toHaveBeenCalled();
    expect(s.chart.applyOptions).not.toHaveBeenCalled();
    expect(s.dm.selection()).toEqual([]);
    expect(pointsOf(s, id)).toEqual(before);
  });
});
