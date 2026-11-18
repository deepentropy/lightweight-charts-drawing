// Touch / pen tap-select on release: a swipe on an unselected drawing pans the chart; a short tap selects.
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

  it("a 300 ms long-press in place does not select", () => {
    const s = setup();
    withUnselectedLine(s);
    s.el.dispatchEvent(ptrAt("pointerdown", "touch", 200, 250, 1000, { pointerId: 1 }));
    s.doc.dispatchEvent(ptrAt("pointerup", "touch", 200, 250, 1300, { pointerId: 1 }));
    expect(s.dm.selection()).toEqual([]);
    expect(s.chart.applyOptions).not.toHaveBeenCalled();
  });

  it("a second finger during the press cancels the tap (pinch never selects)", () => {
    const s = setup();
    withUnselectedLine(s);
    s.el.dispatchEvent(ptrAt("pointerdown", "touch", 200, 250, 1000, { pointerId: 1 }));
    s.doc.dispatchEvent(ptrAt("pointerdown", "touch", 220, 260, 1050, { pointerId: 2, isPrimary: false }));
    s.doc.dispatchEvent(ptrAt("pointerup", "touch", 200, 250, 1100, { pointerId: 1 }));
    expect(s.dm.selection()).toEqual([]);
    expect(s.chart.applyOptions).not.toHaveBeenCalled();
  });

  it("pointercancel leaves the selection empty and no document listener behind", () => {
    const s = setup();
    withUnselectedLine(s);
    s.el.dispatchEvent(ptrAt("pointerdown", "touch", 200, 250, 1000, { pointerId: 1 }));
    s.doc.dispatchEvent(ptrAt("pointercancel", "touch", 200, 250, 1050, { pointerId: 1 }));
    expect(s.dm.selection()).toEqual([]);
    expect(s.doc.liveTotal()).toBe(s.base.doc);
  });

  it("destroy mid-candidate leaves no document listener", () => {
    const s = setup();
    withUnselectedLine(s);
    s.el.dispatchEvent(ptrAt("pointerdown", "touch", 200, 250, 1000, { pointerId: 1 }));
    s.dm.destroy();
    expect(s.doc.liveTotal()).toBe(0);
    expect(s.win.liveTotal()).toBe(0);
    expect(s.el.liveTotal()).toBe(0);
  });

  it.each(["touch", "pen"] as const)("%s: a short still tap selects on release", (type) => {
    const s = setup();
    const id = withUnselectedLine(s);
    s.el.dispatchEvent(ptrAt("pointerdown", type, 200, 250, 1000, { pointerId: 1 }));
    s.doc.dispatchEvent(ptrAt("pointerup", type, 200, 250, 1100, { pointerId: 1 }));
    expect(s.dm.selection()).toEqual([id]);
  });
});

describe("selected drawing keeps today's touch drag", () => {
  it("touch press on the selected body, move 20 px: the line moves and the chart is held then released", () => {
    const s = setup();
    const id = withSelectedLine(s);
    const before = pointsOf(s, id);
    s.el.dispatchEvent(ptr("pointerdown", "touch", 200, 250));
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF]]);
    s.doc.dispatchEvent(ptr("pointermove", "touch", 220, 250));
    s.doc.dispatchEvent(ptr("pointerup", "touch", 220, 250));
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED]]);
    expect(pointsOf(s, id)[0]).not.toEqual(before[0]);
  });

  it("touch press on a selected handle drags that handle", () => {
    const s = setup();
    const id = withSelectedLine(s);
    const before = pointsOf(s, id);
    s.el.dispatchEvent(ptr("pointerdown", "touch", 100, 200));
    s.doc.dispatchEvent(ptr("pointermove", "touch", 120, 220));
    s.doc.dispatchEvent(ptr("pointerup", "touch", 120, 220));
    const after = pointsOf(s, id);
    expect(after[0]).not.toEqual(before[0]);
    expect(after[1]).toEqual(before[1]);
  });

  it("touch press on empty space clears the selection", () => {
    const s = setup();
    withSelectedLine(s);
    s.el.dispatchEvent(ptr("pointerdown", "touch", 600, 100));
    expect(s.dm.selection()).toEqual([]);
    expect(s.chart.applyOptions).not.toHaveBeenCalled();
  });
});
