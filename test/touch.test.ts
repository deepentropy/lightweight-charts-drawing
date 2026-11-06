// Touch and pen gestures: a held gesture ends on pointercancel as well as on pointerup, so the chart gets its
// pan / zoom back.
import { afterEach, describe, expect, it, vi } from "vitest";
import { OFF, SAVED, ptr, setup, withSelectedLine } from "./pointer-harness";

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
