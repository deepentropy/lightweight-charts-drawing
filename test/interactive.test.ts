// View-only manager: `interactive: false` / setInteractive(false) takes no pointer input (no hold, no stopPropagation,
// no hover, no dblclick) and no key action, while the drawings still paint, so a touch or mouse drag over them pans the
// chart. setInteractive(false) clears the selection and a half-placed drawing.
import { afterEach, describe, expect, it, vi } from "vitest";
import { DrawingManager } from "../src";
import { OFF, ev, ptr, setup, withSelectedLine } from "./pointer-harness";

afterEach(() => vi.unstubAllGlobals());

/** Armed trend line placed by two clicks; returns the number of drawings. */
function clickClick(s: ReturnType<typeof setup>): number {
  s.dm.setTool("trend-line");
  s.el.dispatchEvent(ptr("pointerdown", "mouse", 50, 50));
  s.win.dispatchEvent(ptr("pointerup", "mouse", 50, 50));
  s.el.dispatchEvent(ptr("pointerdown", "mouse", 150, 150));
  s.win.dispatchEvent(ptr("pointerup", "mouse", 150, 150));
  return s.dm.drawings().length;
}

describe("default (0.6.3 behaviour)", () => {
  it("armed trend line: click-click creates one drawing", () => {
    expect(clickClick(setup())).toBe(1);
  });
});

describe("interactive: false", () => {
  it("armed tool: clicks create nothing, the press is not stopped, the chart options are untouched", () => {
    const s = setup({ interactive: false });
    s.dm.setTool("trend-line");
    const down = ptr("pointerdown", "mouse", 50, 50);
    const stop = vi.spyOn(down, "stopPropagation");
    s.el.dispatchEvent(down);
    expect(stop).not.toHaveBeenCalled();
    expect(s.chart.applyOptions).not.toHaveBeenCalled();
    expect(s.win.liveTotal()).toBe(s.base.win);
    expect(clickClick(setup({ interactive: false }))).toBe(0);
  });

  it("a touch drag over a selected drawing holds nothing and registers no touchmove guard", () => {
    const s = setup({ interactive: false });
    withSelectedLine(s);
    const down = ptr("pointerdown", "touch", 100, 200);
    const stop = vi.spyOn(down, "stopPropagation");
    s.el.dispatchEvent(down);
    s.doc.dispatchEvent(ptr("pointermove", "touch", 140, 240));
    expect(stop).not.toHaveBeenCalled();
    expect(s.chart.applyOptions).not.toHaveBeenCalled();
    expect(s.el.adds.touchmove).toBeUndefined();
    expect(s.doc.liveTotal()).toBe(s.base.doc);
    expect(s.dm.get(s.dm.drawings()[0].id)!.points[0]).toEqual({ time: 100, price: 300 });
  });

  it("drawings still paint", () => {
    const s = setup({ interactive: false });
    withSelectedLine(s);
    expect(s.dm.scenes(800, 500).length).toBeGreaterThan(0);
  });
});

describe("setInteractive", () => {
  it("false clears the hover and the cursor, and hover stays off", () => {
    const s = setup();
    const id = s.dm.add({ kind: "trend-line", points: [{ time: 100 as never, price: 300 }, { time: 300 as never, price: 200 }] });
    s.el.dispatchEvent(ptr("pointermove", "mouse", 200, 250, { buttons: 0 }));
    expect(s.dm.hoveredId()).toBe(id);
    expect(s.dm.cursorAt()).not.toBeNull();
    s.dm.setInteractive(false);
    expect(s.dm.hoveredId()).toBeNull();
    expect(s.dm.cursorAt()).toBeNull();
    s.el.dispatchEvent(ptr("pointermove", "mouse", 200, 250, { buttons: 0 }));
    expect(s.dm.hoveredId()).toBeNull();

  });

  it("a dblclick is ignored while off (an armed polyline would be finished and the event stopped)", () => {
    const s = setup({ interactive: false });
    s.dm.setTool("polyline");
    const dbl = ptr("dblclick", "mouse", 100, 100);
    const stop = vi.spyOn(dbl, "stopPropagation");
    s.el.dispatchEvent(dbl);
    expect(stop).not.toHaveBeenCalled();
    s.dm.setInteractive(true);
    const dbl2 = ptr("dblclick", "mouse", 100, 100);
    const stop2 = vi.spyOn(dbl2, "stopPropagation");
    s.el.dispatchEvent(dbl2);
    expect(stop2).toHaveBeenCalled();
  });

  it("false while a tool is armed: the press is ignored; true restores placement and selection", () => {
    const s = setup();
    s.dm.setInteractive(false);
    expect(clickClick(s)).toBe(0);
    s.dm.setInteractive(true);
    expect(clickClick(s)).toBe(1);
    s.dm.setTool(null);
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 100, 100));
    expect(s.dm.selection()).toEqual([s.dm.drawings()[0].id]);
    expect(s.chart.applyOptions.mock.calls[0]).toEqual([OFF]);
  });
});

it("the option type is part of DrawingManager's constructor options", () => {
  const o: ConstructorParameters<typeof DrawingManager>[2] = { interactive: false };
  expect(o?.interactive).toBe(false);
});

describe("view-only and the keyboard", () => {
  const key = (s: ReturnType<typeof setup>, k: string) => s.win.dispatchEvent(ev("keydown", { key: k }));

  it("interactive: false, a drawing selected through the API: Delete / Backspace remove nothing, Escape keeps the selection", () => {
    const s = setup({ interactive: false });
    const id = withSelectedLine(s);
    key(s, "Delete");
    key(s, "Backspace");
    expect(s.dm.get(id)).toBeDefined();
    key(s, "Escape");
    expect(s.dm.selection()).toEqual([id]);
  });

  it("interactive: false: Escape does not disarm the tool", () => {
    const s = setup({ interactive: false });
    s.dm.setTool("trend-line");
    key(s, "Escape");
    expect(s.dm.tool()).toBe("trend-line");
  });

  it("setInteractive(false) clears the selection and the pending points; the drawing and the tool stay", () => {
    const s = setup();
    const id = withSelectedLine(s);
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 50, 50));
    s.win.dispatchEvent(ptr("pointerup", "mouse", 50, 50));
    expect((s.dm as unknown as { pending: unknown[] }).pending).toHaveLength(1);
    const selection = vi.fn();
    s.dm.on("selection", selection);
    s.dm.setInteractive(false);
    expect(s.dm.selection()).toEqual([]);
    expect(selection).toHaveBeenCalledWith([]);
    expect((s.dm as unknown as { pending: unknown[] }).pending).toHaveLength(0);
    expect(s.dm.get(id)).toBeDefined();
    expect(s.dm.tool()).toBe("trend-line");
  });

  it("setInteractive(true) brings the key actions back", () => {
    const s = setup({ interactive: false });
    s.dm.setInteractive(true);
    const id = withSelectedLine(s);
    key(s, "Delete");
    expect(s.dm.get(id)).toBeUndefined();
  });
});
