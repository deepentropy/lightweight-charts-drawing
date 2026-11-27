/*
 * Gann box geometry (TV module 972364), shared by the scene and the hit test:
 * the box, the visible price levels (y) and time levels (x), the angle lines.
 */
import type { Pt } from "../_shared";
import type { Coords } from "../coords";
import type { Drawing, LevelDef } from "../types";
import { GANN_BOX_LEVEL_DEFAULTS } from "../specs";

/** Price levels m + coeff·g (y), time levels at bar round(b + coeff·L)
 *  (x, linear when the bars are unknown); Reverse swaps the base point.
 *  Fans (TV, all 7 levels, when shown): level e's time point from hlevel e's
 *  coeff, its price point from vlevel e's coeff. */
export function gannBoxGeom(d: Drawing, pts: Pt[], coords: Coords | null | undefined) {
  const s = d.style;
  const [a, b] = pts;
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const bottom = Math.max(a.y, b.y);
  const hAll: LevelDef[] = s.levels ?? GANN_BOX_LEVEL_DEFAULTS;
  const vAll: LevelDef[] = s.vLevels ?? GANN_BOX_LEVEL_DEFAULTS;
  const [p0, p1] = d.points;
  const rev = !!s.reverse;
  const yOf = (c: number): number => {
    const base = rev ? p1.price : p0.price;
    const span = rev ? p0.price - p1.price : p1.price - p0.price;
    const y = coords?.priceToY(base + c * span);
    return y ?? (rev ? b.y + c * (a.y - b.y) : a.y + c * (b.y - a.y));
  };
  const i0 = coords?.timeToBarIndex(p0.time) ?? null;
  const i1 = coords?.timeToBarIndex(p1.time) ?? null;
  const xOf = (c: number): number => {
    if (coords && i0 != null && i1 != null) {
      const base = rev ? i1 : i0;
      const span = rev ? i0 - i1 : i1 - i0;
      const t = coords.barIndexToTime(Math.round(base + c * span));
      const x = t != null ? coords.timeToX(t) : null;
      if (x != null) return x;
    }
    return rev ? b.x + c * (a.x - b.x) : a.x + c * (b.x - a.x);
  };
  const h = hAll.filter((l) => l.visible).map((l) => ({ ...l, y: yOf(l.coeff) }));
  const v = vAll.filter((l) => l.visible).map((l) => ({ ...l, x: xOf(l.coeff) }));
  const fans = s.fans ?? { visible: false, color: "#9C9C9C" };
  const fanLines: [Pt, Pt][] = [];
  if (fans.visible) {
    for (let e = 0; e < hAll.length; e++) {
      const fx = xOf(hAll[e].coeff);
      fanLines.push([{ x: left, y: bottom }, { x: fx, y: top }], [{ x: right, y: bottom }, { x: fx, y: top }], [{ x: left, y: top }, { x: fx, y: bottom }], [{ x: right, y: top }, { x: fx, y: bottom }]);
      const vl = vAll[e];
      if (!vl) continue;
      const fy = yOf(vl.coeff);
      fanLines.push([{ x: left, y: bottom }, { x: right, y: fy }], [{ x: right, y: bottom }, { x: left, y: fy }], [{ x: left, y: top }, { x: right, y: fy }], [{ x: right, y: top }, { x: left, y: fy }]);
    }
  }
  return { left, right, top, bottom, h, v, fans, fanLines };
}
