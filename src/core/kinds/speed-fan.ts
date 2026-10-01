/*
 * Fib speed resistance fan geometry (TV line-tool-fib-speed-resistance-fan
 * pane view, module 716813), shared by the renderer and the hit test.
 *   price levels: y of p1.price + coeff * (p0.price - p1.price)  (0 = p1, 1 = p0)
 *   time levels:  x of bar round(p1.index + coeff * (p0.index - p1.index))
 *   grid: one horizontal line per price level and one vertical line per time
 *   level, inside the p0-p1 box; rays from p0 through (p1.x, level y) and
 *   (level x, p1.y), extended past the level point.
 * Separate lists like TV: `levels` = price levels (hlevel), `vLevels` = time
 * levels (vlevel; drawings saved before 25/09/2026 use `levels` for both).
 * Reverse (TV): the levels count from p0 instead of p1
 *   price = base + coeff * span, base = reverse ? p0 : p1, span = the other
 *   end minus the base (same for the bar index).
 */
import type { Coords } from "../coords";
import type { Drawing, LevelDef } from "../types";
import type { Pt } from "../_shared";

export type SpeedFanLevel = { coeff: number; color: string };
export type SpeedFanGeometry = {
  /** Price levels (visible, in level order) with their screen y. */
  h: (SpeedFanLevel & { y: number })[];
  /** Time levels (visible, in level order) with their screen x. */
  v: (SpeedFanLevel & { x: number })[];
  box: { left: number; top: number; right: number; bottom: number };
};

export function speedFanGeometry(d: Drawing, pts: Pt[], coords: Coords | null, fallback: LevelDef[]): SpeedFanGeometry {
  const [a, b] = pts;
  const hLevels = (d.style.levels ?? fallback).filter((l) => l.visible);
  const vLevels = (d.style.vLevels ?? d.style.levels ?? fallback).filter((l) => l.visible);
  const rev = !!d.style.reverse;
  const p0 = d.points[0];
  const p1 = d.points[1] ?? d.points[0];
  const baseP = rev ? p0.price : p1.price;
  const spanP = rev ? p1.price - p0.price : p0.price - p1.price;
  const baseY = rev ? a.y : b.y;
  const spanY = rev ? b.y - a.y : a.y - b.y;
  const h = hLevels.map((l) => {
    const y = coords?.priceToY(baseP + l.coeff * spanP) ?? baseY + l.coeff * spanY;
    return { coeff: l.coeff, color: l.color, y };
  });
  const i0 = coords?.timeToBarIndex(p0.time) ?? null;
  const i1 = coords?.timeToBarIndex(p1.time) ?? null;
  const baseX = rev ? a.x : b.x;
  const spanX = rev ? b.x - a.x : a.x - b.x;
  const v = vLevels.map((l) => {
    let x: number | null = null;
    if (coords && i0 != null && i1 != null) {
      const t = coords.barIndexToTime(Math.round((rev ? i0 : i1) + l.coeff * (rev ? i1 - i0 : i0 - i1)));
      x = t != null ? coords.timeToX(t) : null;
    }
    return { coeff: l.coeff, color: l.color, x: x ?? baseX + l.coeff * spanX };
  });
  return {
    h,
    v,
    box: { left: Math.min(a.x, b.x), top: Math.min(a.y, b.y), right: Math.max(a.x, b.x), bottom: Math.max(a.y, b.y) },
  };
}

/** Ray from `a` through `t`, extended past `t` far enough to leave a pane of
 *  size w x h (TV TrendLineRenderer extendright, clipped by the SVG). */
export function extendRay(a: Pt, t: Pt, w: number, h: number): Pt {
  const dx = t.x - a.x;
  const dy = t.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return t;
  const k = Math.max(1, (2 * (w + h)) / len);
  return { x: a.x + dx * k, y: a.y + dy * k };
}
