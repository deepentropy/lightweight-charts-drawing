/*
 * Fib circles ring geometry, shared by the scene and the hit test.
 */
import type { Pt } from "../_shared";
import type { Drawing, LevelDef } from "../types";
import { FIB_CIRCLE_LEVEL_DEFAULTS } from "../specs";

/** Legacy entries (before 24/09/2026): fixed ring ratios. */
export const FIB_CIRCLE_LEGACY_LEVELS = [0.236, 0.382, 0.5, 0.618, 1];

/** TV (fmt 2): axis-aligned ellipses centred on the p0-p1 midpoint, half-axes
 *  0.5·|dx|·coeff × 0.5·|dy|·coeff, one per visible level. Legacy: circles
 *  centred on p0, radius |p1 − p0|·ratio (no level). */
export function fibCircleRings(d: Drawing, pts: Pt[]): { cx: number; cy: number; rings: { rx: number; ry: number; lvl?: LevelDef }[] } {
  const [a, b] = pts;
  if (d.fmt !== 2) {
    const r = Math.hypot(b.x - a.x, b.y - a.y);
    return { cx: a.x, cy: a.y, rings: FIB_CIRCLE_LEGACY_LEVELS.map((k) => ({ rx: r * k, ry: r * k })) };
  }
  const hx = Math.abs(b.x - a.x) / 2;
  const hy = Math.abs(b.y - a.y) / 2;
  const levels = (d.style.levels ?? FIB_CIRCLE_LEVEL_DEFAULTS).filter((l) => l.visible);
  return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, rings: levels.map((lvl) => ({ rx: hx * lvl.coeff, ry: hy * lvl.coeff, lvl })) };
}
