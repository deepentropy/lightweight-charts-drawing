// Characterization of the 0.10.1 hit radii, written on unmodified 0.10.1 and never edited after:
// mouse handle / stroke grab distances, and the same radii for touch with no touchHitSlop.
import { afterEach, describe, expect, it, vi } from "vitest";
import { OFF, ptr, setup, withSelectedLine } from "./pointer-harness";

afterEach(() => vi.unstubAllGlobals());

/** Point 1 of withSelectedLine is at (100, 200). The segment goes down-right, so left of P1 is off the body. */
const P1 = { x: 100, y: 200 };
/** Midpoint of the trend line (100,200)-(300,300). */
const MID = { x: 200, y: 250 };
/** Unit normal to that segment. */
const INV_SQRT5 = 1 / Math.sqrt(5);
const N = { x: -INV_SQRT5, y: 2 * INV_SQRT5 };

function held(s: ReturnType<typeof setup>): boolean {
  return s.chart.applyOptions.mock.calls.some((c) => JSON.stringify(c[0]) === JSON.stringify(OFF));
}

/** Press at (x,y); if the chart is held, drag by (dx,dy) and release. Returns whether the press hit. */
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

describe.each(["mouse", "touch"] as const)("%s hit radii of 0.10.1 (no touchHitSlop)", (pointerType) => {
  it("handle: 12 px from point 1 grabs it (drag moves the point); 13 px does not", () => {
    // Offset left of P1 so the press cannot land on the stroke (the line extends right).
    const near = setup();
    const nearId = withSelectedLine(near);
    const before = near.dm.get(nearId)!.points[0];
    expect(pressDrag(near, pointerType, P1.x - 12, P1.y)).toBe(true);
    const after = near.dm.get(nearId)!.points[0];
    expect(after.time !== before.time || after.price !== before.price).toBe(true);

    const far = setup();
    withSelectedLine(far);
    expect(pressDrag(far, pointerType, P1.x - 13, P1.y)).toBe(false);
    expect(far.dm.selection()).toEqual([]);
  });

  it("stroke: within HIT_TOLERANCE (6 px) of the line body hits it; beyond does not", () => {
    const hitAt = (dist: number) => {
      const s = setup();
      withSelectedLine(s);
      return pressDrag(s, pointerType, MID.x + N.x * dist, MID.y + N.y * dist);
    };
    // Exact 6 is 6+eps under IEEE, so `<= HIT_TOLERANCE` misses; pin just inside / outside.
    expect(hitAt(5.999)).toBe(true);
    expect(hitAt(6.001)).toBe(false);
  });
});
