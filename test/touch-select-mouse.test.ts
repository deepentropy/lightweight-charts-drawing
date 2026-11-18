// Characterization of 0.10.1 mouse selection / drag on unselected and selected drawings.
// Written on unmodified upstream/main and never edited after — the touch tap-select path must keep this green.
import { afterEach, describe, expect, it, vi } from "vitest";
import { OFF, SAVED, ptr, setup, withSelectedLine } from "./pointer-harness";

afterEach(() => vi.unstubAllGlobals());

/** Unselected trend line with anchors at pixels (100, 200) and (300, 300); body mid ≈ (200, 250). */
function withUnselectedLine(s: ReturnType<typeof setup>): string {
  return s.dm.add({ kind: "trend-line", points: [{ time: 100 as never, price: 300 }, { time: 300 as never, price: 200 }] });
}

function pointsOf(s: ReturnType<typeof setup>, id: string) {
  return s.dm.get(id)!.points.map((p) => ({ time: p.time, price: p.price }));
}

describe("mouse selection and drag, as in 0.10.1", () => {
  it("press on an unselected body selects at press and holds the chart", () => {
    const s = setup();
    const id = withUnselectedLine(s);
    const down = ptr("pointerdown", "mouse", 200, 250);
    const stop = vi.spyOn(down, "stopPropagation");
    s.el.dispatchEvent(down);
    expect(s.dm.selection()).toEqual([id]);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF]]);
    s.doc.dispatchEvent(ptr("pointerup", "mouse", 200, 250));
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED]]);
  });

  it("press-drag on an unselected body selects and leaves points unchanged", () => {
    const s = setup();
    const id = withUnselectedLine(s);
    const before = pointsOf(s, id);
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 200, 250));
    expect(s.dm.selection()).toEqual([id]);
    s.doc.dispatchEvent(ptr("pointermove", "mouse", 240, 280));
    s.doc.dispatchEvent(ptr("pointerup", "mouse", 240, 280));
    expect(pointsOf(s, id)).toEqual(before);
  });

  it("press-drag on an unselected endpoint moves that endpoint", () => {
    const s = setup();
    const id = withUnselectedLine(s);
    const before = pointsOf(s, id);
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 100, 200));
    expect(s.dm.selection()).toEqual([id]);
    s.doc.dispatchEvent(ptr("pointermove", "mouse", 150, 250));
    s.doc.dispatchEvent(ptr("pointerup", "mouse", 150, 250));
    const after = pointsOf(s, id);
    expect(after[0]).not.toEqual(before[0]);
    expect(after[1]).toEqual(before[1]);
  });

  it("press-drag on the selected line's body moves the line", () => {
    const s = setup();
    const id = withSelectedLine(s);
    const before = pointsOf(s, id);
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 200, 250));
    s.doc.dispatchEvent(ptr("pointermove", "mouse", 240, 280));
    s.doc.dispatchEvent(ptr("pointerup", "mouse", 240, 280));
    const after = pointsOf(s, id);
    expect(after[0]).not.toEqual(before[0]);
    expect(after[1]).not.toEqual(before[1]);
  });
});
