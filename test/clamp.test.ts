// clampToPane: a pending placement accepts a press outside the pane and clamps it to the pane edge; the preview,
// a dragToPlace release and the drag pointer are clamped too. Option off, or no placement pending: a press outside
// the pane is ignored.
import { afterEach, describe, expect, it, vi } from "vitest";
import { ptr, setup, withSelectedLine } from "./pointer-harness";

afterEach(() => vi.unstubAllGlobals());

// Pane 800 x 500; price = 500 - y, time = x.
const pending = (o: { clampToPane?: boolean }) => {
  const s = setup(o);
  s.dm.setTool("trend-line");
  s.el.dispatchEvent(ptr("pointerdown", "mouse", 100, 200));
  s.win.dispatchEvent(ptr("pointerup", "mouse", 100, 200));
  return s;
};
const pts = (s: ReturnType<typeof setup>) => s.dm.drawings().map((d) => d.points);

describe("pending placement, press outside the pane", () => {
  it("option off: ignored, point 1 stays pending (0.6.3)", () => {
    const s = pending({});
    const down = ptr("pointerdown", "mouse", 300, 600);
    const stop = vi.spyOn(down, "stopPropagation");
    s.el.dispatchEvent(down);
    expect(stop).not.toHaveBeenCalled();
    expect(s.dm.drawings()).toHaveLength(0);
    expect(s.dm.tool()).toBe("trend-line");
  });

  it("option on: below the pane lands on the bottom edge, and the chart does not pan", () => {
    const s = pending({ clampToPane: true });
    const down = ptr("pointerdown", "mouse", 300, 600);
    const stop = vi.spyOn(down, "stopPropagation");
    s.el.dispatchEvent(down);
    expect(stop).toHaveBeenCalled();
    expect(pts(s)).toEqual([[{ time: 100, price: 300 }, { time: 300, price: 0 }]]);
  });

  it("option on: above the pane lands on the top edge", () => {
    const s = pending({ clampToPane: true });
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 300, -40));
    expect(pts(s)).toEqual([[{ time: 100, price: 300 }, { time: 300, price: 500 }]]);
  });

  it("option on: x beyond the width is clamped to the width", () => {
    const s = pending({ clampToPane: true });
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 900, 600));
    expect(pts(s)).toEqual([[{ time: 100, price: 300 }, { time: 800, price: 0 }]]);
  });
});

describe("option on, no placement pending", () => {
  it("a press outside the pane is still ignored", () => {
    const s = setup({ clampToPane: true });
    s.dm.setTool("trend-line");
    const down = ptr("pointerdown", "mouse", 300, 600);
    const stop = vi.spyOn(down, "stopPropagation");
    s.el.dispatchEvent(down);
    expect(stop).not.toHaveBeenCalled();
    expect(s.chart.applyOptions).not.toHaveBeenCalled();
    expect(s.win.liveTotal()).toBe(s.base.win);
  });
});

describe("drags", () => {
  const first = (s: ReturnType<typeof setup>, id: string) => s.dm.get(id)!.points;

  it("handle drag past the pane bottom stops at the bottom edge", () => {
    const s = setup({ clampToPane: true });
    const id = withSelectedLine(s);
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 100, 200));
    s.doc.dispatchEvent(ptr("pointermove", "mouse", 120, 700));
    s.doc.dispatchEvent(ptr("pointerup", "mouse", 120, 700));
    expect(first(s, id)[0]).toEqual({ time: 120, price: 0 });
  });

  it("option off: the same handle drag leaves the pane", () => {
    const s = setup();
    const id = withSelectedLine(s);
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 100, 200));
    s.doc.dispatchEvent(ptr("pointermove", "mouse", 120, 700));
    s.doc.dispatchEvent(ptr("pointerup", "mouse", 120, 700));
    expect(first(s, id)[0]).toEqual({ time: 120, price: -200 });
  });

  it("body drag: the pointer is clamped before the delta, the grabbed point stays inside", () => {
    const s = setup({ clampToPane: true });
    const id = withSelectedLine(s);
    // Grab the body at its middle (200, 250), drag far below the pane: delta y = 500 - 250.
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 200, 250));
    s.doc.dispatchEvent(ptr("pointermove", "mouse", 200, 900));
    s.doc.dispatchEvent(ptr("pointerup", "mouse", 200, 900));
    expect(first(s, id)[0]).toEqual({ time: 100, price: 50 });
  });
});

describe("with dragToPlace and the placement preview", () => {
  const cursor = (s: ReturnType<typeof setup>) => (s.dm as unknown as { cursor: { x: number; y: number } | null }).cursor;

  it("option on: a dragToPlace release below the pane lands on the bottom edge", () => {
    const s = setup({ clampToPane: true, dragToPlace: true });
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 100, 200));
    s.doc.dispatchEvent(ptr("pointermove", "mouse", 300, 650));
    expect(cursor(s)).toEqual({ x: 300, y: 500 });
    s.doc.dispatchEvent(ptr("pointerup", "mouse", 300, 650));
    expect(pts(s)).toEqual([[{ time: 100, price: 300 }, { time: 300, price: 0 }]]);
  });

  it("option off: the dragToPlace release keeps the raw pointer (outside the pane)", () => {
    const s = setup({ dragToPlace: true });
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 100, 200));
    s.doc.dispatchEvent(ptr("pointermove", "mouse", 300, 650));
    s.doc.dispatchEvent(ptr("pointerup", "mouse", 300, 650));
    expect(pts(s)).toEqual([[{ time: 100, price: 300 }, { time: 300, price: -150 }]]);
  });

  it("option on: the preview follows the pointer onto the pane edge while a point is pending", () => {
    const s = pending({ clampToPane: true });
    s.el.dispatchEvent(ptr("pointermove", "mouse", 900, -30));
    expect(cursor(s)).toEqual({ x: 800, y: 0 });
  });

  it("option on, nothing pending: the preview cursor is not clamped", () => {
    const s = setup({ clampToPane: true });
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointermove", "mouse", 900, -30));
    expect(cursor(s)).toEqual({ x: 900, y: -30 });
  });
});
