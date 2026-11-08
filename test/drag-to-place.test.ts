// dragToPlace: press places point 1, release places point 2 of a tool with two or more points. A movement under
// DRAG_THRESHOLD is a click (click-click still works); pointercancel keeps point 1 pending and gives the chart back.
import { afterEach, describe, expect, it, vi } from "vitest";
import { OFF, SAVED, ptr, setup } from "./pointer-harness";

afterEach(() => vi.unstubAllGlobals());

const make = (o: { dragToPlace?: boolean; stayInDrawingMode?: boolean } = { dragToPlace: true }) => setup(o);

const pts = (s: ReturnType<typeof setup>) => s.dm.drawings().map((d) => d.points);

describe("option off: 0.6.3 placement", () => {
  it("press, drag, release places nothing; point 1 stays pending", () => {
    const s = make({});
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 100, 200));
    s.doc.dispatchEvent(ptr("pointermove", "mouse", 140, 200));
    s.doc.dispatchEvent(ptr("pointerup", "mouse", 140, 200));
    s.win.dispatchEvent(ptr("pointerup", "mouse", 140, 200));
    expect(s.dm.drawings()).toHaveLength(0);
    expect(s.doc.adds.pointermove).toBeUndefined();
    // click-click still completes it
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 300, 300));
    s.win.dispatchEvent(ptr("pointerup", "mouse", 300, 300));
    expect(s.dm.drawings()).toHaveLength(1);
  });
});

describe("option on", () => {
  it("press, drag, release places a trend line A to B and releases the tool", () => {
    const s = make();
    const tool = vi.fn();
    s.dm.on("tool", tool);
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 100, 200));
    expect(s.dm.drawings()).toHaveLength(0);
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF]]);
    s.doc.dispatchEvent(ptr("pointermove", "mouse", 200, 250));
    s.doc.dispatchEvent(ptr("pointerup", "mouse", 300, 300));
    expect(pts(s)).toEqual([[{ time: 100, price: 300 }, { time: 300, price: 200 }]]);
    expect(tool).toHaveBeenLastCalledWith(null);
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED]]);
    expect(s.doc.liveTotal()).toBe(s.base.doc);
  });

  it("stayInDrawingMode keeps the tool armed", () => {
    const s = make({ dragToPlace: true, stayInDrawingMode: true });
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 100, 200));
    s.doc.dispatchEvent(ptr("pointerup", "mouse", 300, 300));
    expect(s.dm.drawings()).toHaveLength(1);
    expect(s.dm.tool()).toBe("trend-line");
  });

  it("a movement under 3 px is a click: point 1 stays pending, a second click completes", () => {
    const s = make();
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 100, 200));
    s.doc.dispatchEvent(ptr("pointermove", "mouse", 102, 200));
    s.doc.dispatchEvent(ptr("pointerup", "mouse", 102, 200));
    expect(s.dm.drawings()).toHaveLength(0);
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED]]);
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 300, 300));
    s.win.dispatchEvent(ptr("pointerup", "mouse", 300, 300));
    expect(pts(s)).toEqual([[{ time: 100, price: 300 }, { time: 300, price: 200 }]]);
  });

  it("a one-point tool is placed on press, no watcher", () => {
    const s = make();
    s.dm.setTool("horizontal-line");
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 100, 200));
    expect(s.dm.drawings()).toHaveLength(1);
    expect(s.doc.adds.pointermove).toBeUndefined();
    s.win.dispatchEvent(ptr("pointerup", "mouse", 100, 200));
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED]]);
  });

  it("a three-point tool: drag places points 1 and 2, the third by click", () => {
    const s = make();
    s.dm.setTool("parallel-channel");
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 100, 200));
    s.doc.dispatchEvent(ptr("pointerup", "mouse", 300, 300));
    expect(s.dm.drawings()).toHaveLength(0);
    expect(s.dm.tool()).toBe("parallel-channel");
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 200, 400));
    s.win.dispatchEvent(ptr("pointerup", "mouse", 200, 400));
    expect(s.dm.drawings()).toHaveLength(1);
  });

  it("variable-length and freehand tools are not drag-placed", () => {
    const s = make();
    s.dm.setTool("polyline");
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 100, 200));
    s.win.dispatchEvent(ptr("pointerup", "mouse", 100, 200));
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 200, 200));
    s.win.dispatchEvent(ptr("pointerup", "mouse", 200, 200));
    expect(s.dm.drawings()).toHaveLength(0);
    expect(s.dm.tool()).toBe("polyline");
  });

  it("pointercancel: nothing placed, point 1 pending, chart released", () => {
    const s = make();
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", "touch", 100, 200));
    s.doc.dispatchEvent(ptr("pointermove", "touch", 200, 250));
    s.doc.dispatchEvent(ptr("pointercancel", "touch", 200, 250));
    expect(s.dm.drawings()).toHaveLength(0);
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED]]);
    expect(s.doc.liveTotal()).toBe(s.base.doc);
    expect(s.el.live("touchmove")).toBe(0);
    // point 1 is still pending: one more click places the line
    s.el.dispatchEvent(ptr("pointerdown", "touch", 300, 300));
    s.win.dispatchEvent(ptr("pointerup", "touch", 300, 300));
    expect(pts(s)).toEqual([[{ time: 100, price: 300 }, { time: 300, price: 200 }]]);
  });

  it("Escape during the drag drops point 1; the release places nothing", () => {
    const s = make();
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 100, 200));
    s.win.dispatchEvent(Object.assign(new Event("keydown"), { key: "Escape" }));
    s.doc.dispatchEvent(ptr("pointerup", "mouse", 300, 300));
    expect(s.dm.drawings()).toHaveLength(0);
  });

  it("destroy() during the drag leaves no listener", () => {
    const s = make();
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", "touch", 100, 200));
    s.dm.destroy();
    expect(s.doc.liveTotal()).toBe(0);
    expect(s.win.liveTotal()).toBe(0);
    expect(s.el.liveTotal()).toBe(0);
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF], [SAVED]]);
  });
});

describe("option on with keyboard: false (Shift / Ctrl from the pointer events)", () => {
  // Press at (100, 200) = { time 100, price 300 }; the release at (300, 210) is 10 px below the horizontal.
  const drag = (moveMods: Record<string, unknown>, upMods: Record<string, unknown>) => {
    const s = setup({ dragToPlace: true, keyboard: false });
    s.dm.setTool("trend-line");
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 100, 200));
    s.doc.dispatchEvent(ptr("pointermove", "mouse", 300, 210, moveMods));
    s.doc.dispatchEvent(ptr("pointerup", "mouse", 300, 210, upMods));
    return pts(s)[0]?.[1];
  };

  it("without Shift, point 2 is where the pointer was released", () => {
    expect(drag({}, {})).toEqual({ time: 300, price: 290 });
  });

  it("Shift held during the drag and at the release constrains point 2", () => {
    expect(drag({ shiftKey: true }, { shiftKey: true })).toEqual({ time: 300, price: 300 });
  });

  it("Shift pressed only at the release still constrains point 2", () => {
    expect(drag({}, { shiftKey: true })).toEqual({ time: 300, price: 300 });
  });
});
