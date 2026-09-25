/*
 * Trend-based fib time level positions (TV line-tool-trend-based-fib-time
 * pane view), shared by the renderer and the hit test: level x = the bar
 * round(p2.index + coeff · (p1.index − p0.index)); no levels when p0 and p1
 * are on the same bar. Without coords (or an unknown bar), the screen
 * fallback p2.x + coeff · (p1.x − p0.x).
 */
import type { Coords } from "../coords";
import type { Drawing, LevelDef } from "../types";
import type { Pt } from "../_shared";

export function trendFibTimeLevels(d: Drawing, pts: Pt[], coords: Coords | null, levels: LevelDef[]): (LevelDef & { x: number })[] {
  const [a, b, c] = pts;
  if (!a || !b || !c) return [];
  const [p0, p1, p2] = d.points;
  const i0 = coords && p0 ? coords.timeToBarIndex(p0.time) : null;
  const i1 = coords && p1 ? coords.timeToBarIndex(p1.time) : null;
  const i2 = coords && p2 ? coords.timeToBarIndex(p2.time) : null;
  if (i0 != null && i1 != null && i0 === i1) return [];
  return levels.map((l) => {
    let x: number | null = null;
    if (coords && i0 != null && i1 != null && i2 != null) {
      const t = coords.barIndexToTime(Math.round(i2 + l.coeff * (i1 - i0)));
      x = t != null ? coords.timeToX(t) : null;
    }
    return { ...l, x: x ?? c.x + l.coeff * (b.x - a.x) };
  });
}
