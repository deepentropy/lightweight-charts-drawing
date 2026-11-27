/*
 * Fib retracement / trend-based fib extension level geometry, shared by the
 * scenes, the hit test and fibLevelAt: the levels' x-range and the screen y
 * and price of a coefficient.
 */
import type { Pt } from "../_shared";
import type { Coords } from "../coords";
import type { Drawing } from "../types";

export type FibLevelGeom = {
  left: number;
  right: number;
  yOf: (coeff: number) => number;
  priceOf: (coeff: number) => number;
};

/** Legacy fib circles (before 24/09/2026): fixed rings, radius × coeff. */
export const FIB_CIRCLE_LEGACY_LEVELS = [0.236, 0.382, 0.5, 0.618, 1];

/** Null for other kinds or missing points. `w` = pane width (extend flags). */
export function fibLevelGeom(d: Drawing, pts: Pt[], w: number, coords: Coords | null): FibLevelGeom | null {
  const s = d.style;
  if (d.kind === "fib-retracement" && pts.length >= 2 && d.points.length >= 2) {
    const [a, b] = pts;
    const priceA = d.points[0].price;
    const priceB = d.points[1].price;
    // "Fib levels based on log scale" (TV fibLevelsBasedOnLogScale): level
    // prices interpolate in ln(price) space; TV only honours it on a log price
    // scale, and non-positive anchors (no ln) fall back to linear.
    const useLog = !!s.fibLevelsBasedOnLogScale && !!coords?.isLog() && priceA > 0 && priceB > 0;
    // reverse mirrors the ladder: 0 at the first click instead of the second.
    const priceOf = (c: number) => {
      const pEnd = s.reverse ? priceA : priceB; // coeff-0 anchor
      const pStart = s.reverse ? priceB : priceA;
      return useLog ? Math.exp(Math.log(pEnd) + c * (Math.log(pStart) - Math.log(pEnd))) : pEnd + c * (pStart - pEnd);
    };
    // TV fibLevelCoordinate: log mode interpolates the anchors' coordinates;
    // linear mode maps the level price through the scale.
    const yLin = (c: number) => (s.reverse ? a.y + (b.y - a.y) * c : b.y + (a.y - b.y) * c);
    return {
      // TV: levels span the anchors' x-range; the extend flags (default off)
      // stretch them to the pane edges.
      left: s.extendLeft ? 0 : Math.min(a.x, b.x),
      right: s.extendRight ? w : Math.max(a.x, b.x),
      yOf: (c) => (useLog ? yLin(c) : coords?.priceToY(priceOf(c)) ?? yLin(c)),
      priceOf,
    };
  }
  if (d.kind === "trend-based-fib-extension" && pts.length >= 3 && d.points.length >= 3) {
    const [, b, c] = pts;
    const p0 = d.points[0].price;
    const p1 = d.points[1].price;
    const pc = d.points[2].price;
    const move = s.reverse ? p0 - p1 : p1 - p0;
    const moveY = s.reverse ? pts[0].y - pts[1].y : pts[1].y - pts[0].y;
    // Log scale (TV): the move projects from pc in ln(price) space.
    const useLog = !!s.fibLevelsBasedOnLogScale && !!coords?.isLog() && p0 > 0 && p1 > 0 && pc > 0;
    const priceOf = (lvl: number) => {
      if (!useLog) return pc + move * lvl;
      const lnMove = s.reverse ? Math.log(p0) - Math.log(p1) : Math.log(p1) - Math.log(p0);
      return Math.exp(Math.log(pc) + lvl * lnMove);
    };
    const yLin = (lvl: number) => c.y + moveY * lvl;
    return {
      left: s.extendLeft ? 0 : Math.min(b.x, c.x),
      right: s.extendRight ? w : Math.max(b.x, c.x),
      yOf: (lvl) => (useLog ? yLin(lvl) : coords?.priceToY(priceOf(lvl)) ?? yLin(lvl)),
      priceOf,
    };
  }
  return null;
}
