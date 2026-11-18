// touchHitSlop: widens handle / stroke hit testing for touch and pen only; mouse stays at 0.10.1 radii.
import { afterEach, describe, expect, it, vi } from "vitest";
import { OFF, ptr, setup, withSelectedLine } from "./pointer-harness";

afterEach(() => vi.unstubAllGlobals());

const P1 = { x: 100, y: 200 };

function held(s: ReturnType<typeof setup>): boolean {
  return s.chart.applyOptions.mock.calls.some((c) => JSON.stringify(c[0]) === JSON.stringify(OFF));
}

function pressDrag(
  s: ReturnType<typeof setup>,
  pointerType: string,
  x: number,
  y: number,
  dx = 30,
  dy = 0,
): boolean {
  s.el.dispatchEvent(ptr("pointerdown", pointerType, x, y));
  if (!held(s)) return false;
  s.doc.dispatchEvent(ptr("pointermove", pointerType, x + dx, y + dy));
  s.doc.dispatchEvent(ptr("pointerup", pointerType, x + dx, y + dy));
  return true;
}

describe("touchHitSlop: 16", () => {
  it("TOUCH press 26 px from point 1 grabs the handle; 29 px does not", () => {
    const near = setup({ touchHitSlop: 16 });
    const nearId = withSelectedLine(near);
    const before = near.dm.get(nearId)!.points[0];
    expect(pressDrag(near, "touch", P1.x - 26, P1.y)).toBe(true);
    const after = near.dm.get(nearId)!.points[0];
    expect(after.time !== before.time || after.price !== before.price).toBe(true);

    const far = setup({ touchHitSlop: 16 });
    withSelectedLine(far);
    expect(pressDrag(far, "touch", P1.x - 29, P1.y)).toBe(false);
    expect(far.dm.selection()).toEqual([]);
  });

  it("MOUSE press 13 px from the handle does not grab it (mouse ignores the slop)", () => {
    const s = setup({ touchHitSlop: 16 });
    withSelectedLine(s);
    expect(pressDrag(s, "mouse", P1.x - 13, P1.y)).toBe(false);
    expect(s.dm.selection()).toEqual([]);
  });
});
