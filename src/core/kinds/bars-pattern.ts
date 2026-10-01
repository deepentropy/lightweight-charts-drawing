/*
 * Bars pattern geometry (TV line-tool-bars-pattern pane view, module
 * 432434), shared by the renderer and the hit test. The frozen bars
 * (`d.pattern`) are spread evenly between the two points (spacing
 * |x0 − x1| / (n − 1)); prices map through c(p) = priceToY(p) · scale,
 * scale = the points' pixel height / the pattern's first-to-last pixel
 * height, shifted so the first pattern price sits on the left point.
 * Mirrored inverts the prices around the pattern's middle, flipped reverses
 * the order; each toggle swaps the two points' prices (TV
 * `_switchPointsPrice`), so the effective prices swap when exactly one is on.
 */
import type { Coords } from "../coords";
import type { Drawing } from "../types";
import type { Pt } from "../_shared";

/** TV modes: HL bars, OC bars and the five line sources. */
export const BAR_PATTERN_MODES = ["bars", "oc", "line", "line-open", "line-high", "line-low", "line-hl2"] as const;
export type BarPatternMode = (typeof BAR_PATTERN_MODES)[number];
type Bar = [number, number, number, number];

/** Rendered prices of one pattern bar [o, h, l, c] by mode (TV table `b`). */
function patternBarPrices(bar: Bar, mode: BarPatternMode): number[] {
  const [o, h, l, c] = bar;
  switch (mode) {
    case "bars": return [h, l];
    case "oc": return [o, c];
    case "line": return [c];
    case "line-open": return [o];
    case "line-high": return [h];
    case "line-low": return [l];
    default: return [(h + l) / 2];
  }
}

/** TV firstPatternPrice / lastPatternPrice (tables `_e` / `Pe`, swapped when
 *  flipped). */
function patternEdgePrice(bar: Bar, mode: BarPatternMode, first: boolean, flipped: boolean): number {
  const [o, h, l, c] = bar;
  if (mode === "line-hl2") return (h + l) / 2;
  const useFirst = first !== flipped;
  switch (mode) {
    case "bars": return useFirst ? h : l;
    case "oc": return useFirst ? o : c;
    case "line": return c;
    case "line-open": return o;
    case "line-high": return h;
    default: return l;
  }
}

export type BarsPatternGeometry = {
  lineMode: boolean;
  /** HL / OC modes: one 2px bar per pattern bar (x centre, top / bottom y). */
  bars: { x: number; top: number; bottom: number }[];
  /** Line modes: the polyline vertices. */
  line: Pt[];
};

/** Screen geometry of a bars pattern, or null without a snapshot / data. */
export function barsPatternGeometry(d: Drawing, pts: Pt[], coords: Coords | null): BarsPatternGeometry | null {
  if (d.kind !== "bar-pattern" || !coords) return null;
  const rows0 = d.pattern?.bars ?? [];
  if (rows0.length === 0 || pts.length < 2) return null;
  const s = d.style;
  const [pa, pb] = pts;
  const mode: BarPatternMode = (BAR_PATTERN_MODES as readonly string[]).includes(s.patternMode ?? "") ? (s.patternMode as BarPatternMode) : "bars";
  let rows: Bar[] = rows0;
  if (s.mirrored) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of rows) { lo = Math.min(lo, r[2], r[1]); hi = Math.max(hi, r[1], r[2]); }
    if (lo < hi) {
      const m = (lo + hi) / 2;
      const inv = (v: number) => m - (v - m);
      rows = rows.map(([o, h, l, c]) => [inv(o), inv(h), inv(l), inv(c)] as Bar);
    }
  }
  if (s.flipped) rows = [...rows].reverse();
  const swap = !!s.mirrored !== !!s.flipped;
  const price0 = swap ? d.points[1].price : d.points[0].price;
  const price1 = swap ? d.points[0].price : d.points[1].price;
  const y0 = coords.priceToY(price0);
  const y1 = coords.priceToY(price1);
  const firstP = patternEdgePrice(rows[0], mode, true, !!s.flipped);
  const lastP = patternEdgePrice(rows[rows.length - 1], mode, false, !!s.flipped);
  const yf = coords.priceToY(firstP);
  const yl = coords.priceToY(lastP);
  if (y0 == null || y1 == null || yf == null || yl == null) return null;
  const scale = yl !== yf ? +((y1 - y0) / (yl - yf)).toFixed(8) : 1;
  const c = (p: number) => (coords.priceToY(p) ?? 0) * scale;
  const i0 = coords.timeToBarIndex(d.points[0].time);
  const i1 = coords.timeToBarIndex(d.points[1].time);
  const leftIsP0 = i0 == null || i1 == null || i0 <= i1;
  const g = leftIsP0 ? { x: pa.x, y: y0 } : { x: pb.x, y: y1 };
  const n = rows.length;
  const step = n > 1 ? Math.abs(pa.x - pb.x) / (n - 1) : 0;
  const shift = g.y - c(firstP);
  const xs = rows.map((_, t) => Math.round(g.x + t * step + 0.5));
  const lineMode = mode !== "bars" && mode !== "oc";
  if (lineMode) {
    return { lineMode, bars: [], line: rows.map((r, t) => ({ x: xs[t], y: Math.round(c(patternBarPrices(r, mode)[0])) + shift })) };
  }
  return {
    lineMode,
    line: [],
    bars: rows.map((r, t) => {
      const [pA, pB] = patternBarPrices(r, mode);
      const ya = Math.round(c(pA)) + shift;
      const yb = Math.round(c(pB)) + shift;
      return { x: xs[t], top: Math.min(ya, yb), bottom: Math.max(ya, yb) };
    }),
  };
}
