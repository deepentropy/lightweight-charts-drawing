/*
 * Data-driven tools as scenes (moved from OpenTrader DrawingsOverlay, port
 * phase 2): regression trend, anchored VWAP, fixed range / anchored volume
 * profile. They compute over the chart's bars in range (coords.bars()) and
 * project the series back through coords; without bars in range they draw a
 * simple geometric fallback.
 */
import { dashFor, HANDLE_RADIUS, HIT_TOLERANCE, type Pt } from "../_shared";
import type { Coords } from "../coords";
import type { Drawing, DrawingStyle, RegressionLine } from "../types";
import { REGRESSION_LINE_DEFAULTS } from "../specs";
import { anchoredVpBox, fixedVpBox, regressionScreenLines, vwapBandLine, vwapScreenSeries } from "../kinds/data-series";
import type { Scene, SceneItem } from "./types";
import { levelFillOpacity } from "./levels";

/** Regression trend (line-tool-regression-trend + module 742142): base line =
 *  the close-vs-index least-squares fit over [t0,t1]; bands at base ± dev·σ
 *  (style upper/lower deviation, factory +2/−2); channel fills between each
 *  band and the base; Pearson's R printed under the DOWN line's start (12px,
 *  centered, 4px below); styles.extendLines → all lines extend right.
 *  Geometry comes from the shared data-series helper so the rendered shape and
 *  the hit region are computed identically. */
export function sceneRegressionTrend(d: Drawing, pts: Pt[], selected: boolean, w: number, s: DrawingStyle, coords: Coords | null): Scene {
  const rl = s.regressionLines ?? REGRESSION_LINE_DEFAULTS;
  const lines = regressionScreenLines(d, coords, w);
  if (!lines) {
    const out: Scene = [{ t: "line", a: pts[0], b: pts[1], stroke: rl.base.color, strokeWidth: rl.base.width, dash: dashFor({ ...s, lineStyle: rl.base.style }), cap: "round" }];
    if (selected) out.push({ t: "anchors", pts });
    return out;
  }
  // TV RegressionTrendPaneView: lines in the order down, base, up (visible
  // ones only); the band between two neighbours is filled with the UPPER
  // line's colour at the style transparency (up band blue, base-down band
  // red); the lines are drawn opaque.
  const segs = [
    { seg: lines.lower, st: rl.down },
    { seg: lines.center, st: rl.base },
    { seg: lines.upper, st: rl.up },
  ].filter((x): x is { seg: [Pt, Pt]; st: RegressionLine } => !!x.seg && x.st.visible);
  const fillO = levelFillOpacity(s);
  const out: Scene = [];
  if (fillO > 0) {
    segs.slice(1).forEach((hi, i) => {
      const lo = segs[i].seg;
      out.push({ t: "polygon", pts: [lo[0], lo[1], hi.seg[1], hi.seg[0]], fill: hi.st.color, fillOpacity: fillO, stroke: "none", inert: true });
    });
  }
  for (const x of segs) {
    out.push(
      { t: "hit", a: x.seg[0], b: x.seg[1], width: HIT_TOLERANCE * 2 },
      { t: "line", a: x.seg[0], b: x.seg[1], stroke: x.st.color, strokeWidth: x.st.width, dash: dashFor({ ...s, lineStyle: x.st.style }), cap: "round" },
    );
  }
  // TV: "" + pearsons (full precision) under the down line's start, 12px,
  // centred, 4px below, in the down line colour.
  const l = lines.lower;
  if (s.showPearsons !== false && l) {
    out.push({ t: "text", x: l[0].x, y: l[0].y + 4, text: String(lines.pearsons), anchor: "middle", baseline: "hanging", size: 12, fill: rl.down.color, inert: true });
  }
  // TV _updateAnchorsPrice: the anchors sit on the base line.
  if (selected) out.push({ t: "anchors", pts: lines.anchors });
  return out;
}

/** Anchored VWAP (LineToolAnchoredVWAP): cumulative volume-weighted average of
 *  the source price from the anchor bar forward, plus the visible ±σ bands
 *  (vwap ± mult·σ of the cumulative weighted variance — the study's
 *  UpperBand/LowerBand plot pairs). Geometry from the shared data-series
 *  helper so the hit region matches. */
export function sceneAnchoredVwap(d: Drawing, pts: Pt[], selected: boolean, w: number, s: DrawingStyle, coords: Coords | null): Scene {
  const dash = dashFor(s);
  const series = vwapScreenSeries(d, coords);
  // TV draws no text on the chart for the anchored VWAP (study plots + axis
  // labels only). Transparent target over the anchor (vwapHit's anchor test).
  const badge: Scene = [{ t: "circle", cx: pts[0].x, cy: pts[0].y, r: HANDLE_RADIUS + HIT_TOLERANCE, fill: "transparent" }];
  if (selected) badge.push({ t: "anchors", pts });
  if (series.line.length < 2) {
    const b = { x: w, y: pts[0].y };
    return [
      { t: "hit", a: pts[0], b, width: 12 },
      { t: "line", a: pts[0], b, stroke: s.color, strokeWidth: s.width, dash },
      ...badge,
    ];
  }
  const out: Scene = [];
  const polyPair = (line: Pt[], color: string, width: number, lineDash?: string): SceneItem[] => [
    { t: "polyline", pts: line, fill: "none", stroke: "transparent", strokeWidth: HIT_TOLERANCE * 2, join: "round" },
    { t: "polyline", pts: line, fill: "none", stroke: color, strokeWidth: width, dash: lineDash, join: "round" },
  ];
  for (const band of series.bands) {
    if (band.upper.length < 2 || band.lower.length < 2) continue;
    // TV areaBackground ("Background #1") fills between UpperBand and
    // LowerBand only (band #1), in one colour (factory #4caf50, transparency 95).
    if (s.fillBackground === true && band.index === 0) {
      out.push({ t: "polygon", pts: [...band.upper, ...band.lower.slice().reverse()], fill: s.backgroundColor ?? "#4caf50", fillOpacity: levelFillOpacity(s), stroke: "none", inert: true });
    }
    for (const [side, line] of [["upper", band.upper], ["lower", band.lower]] as const) {
      const st = vwapBandLine(s, band.index, side);
      if (st.visible) out.push(...polyPair(line, st.color, st.width));
    }
  }
  out.push(...polyPair(series.line, s.color, s.width, dash), ...badge);
  return out;
}

/** Volume profile histogram: box background rgba(38,198,218,0.05); rows of
 *  up volume (cyan) at the base and down volume (pink) beyond it, 0.75 alpha
 *  in the value area and 0.5 outside, 30% of the box width, from the left
 *  or the right edge; POC line #DBDBDB width 2 across the box. */
function volumeProfileScene(box: NonNullable<ReturnType<typeof fixedVpBox>>, coords: Coords, fromRight: boolean): SceneItem[] {
  const { left, right, top, bottom, vp } = box;
  const width = Math.max(1, right - left);
  const histW = 0.3 * width;
  const n = vp.rows.length;
  const step = (vp.hi - vp.lo) / n;
  const rowY = (i: number) => {
    const y0 = coords.priceToY(vp.lo + (i + 1) * step) ?? top;
    const y1 = coords.priceToY(vp.lo + i * step) ?? bottom;
    return { y: Math.min(y0, y1), h: Math.abs(y1 - y0) };
  };
  const poc = rowY(vp.poc);
  const pocY = poc.y + poc.h / 2;
  const items: SceneItem[] = [];
  vp.rows.forEach((row, i) => {
    const r = rowY(i);
    const inVa = i >= vp.vaFrom && i <= vp.vaTo;
    const upW = vp.maxTotal > 0 ? (row.up / vp.maxTotal) * histW : 0;
    const downW = vp.maxTotal > 0 ? (row.down / vp.maxTotal) * histW : 0;
    const h = Math.max(1, r.h - 1);
    const upX = fromRight ? right - upW : left;
    const downX = fromRight ? right - upW - downW : left + upW;
    items.push(
      { t: "rect", x: upX, y: r.y, w: upW, h, fill: inVa ? "rgba(38,198,218,0.75)" : "rgba(38,198,218,0.5)" },
      { t: "rect", x: downX, y: r.y, w: downW, h, fill: inVa ? "rgba(236,64,122,0.75)" : "rgba(236,64,122,0.5)" },
    );
  });
  items.push({ t: "line", a: { x: left, y: pocY }, b: { x: right, y: pocY }, stroke: "#DBDBDB", strokeWidth: 2 });
  return [
    { t: "rect", x: left, y: top, w: width, h: Math.max(1, bottom - top), fill: "rgba(38,198,218,0.05)" },
    { t: "group", inert: true, items },
  ];
}

/** Fixed range volume profile (TV LineToolFixedRangeVolumeProfile factory
 *  graphics): profile over the bars between P0 and P1 (24 rows over their
 *  low-high, Up/Down, 70% value area); box = the P0-P1 time span × the bars'
 *  price range; histogram drawn from the LEFT edge (left_to_right). Anchors
 *  at P0 / P1. */
export function sceneFixedRangeVolumeProfile(d: Drawing, pts: Pt[], selected: boolean, coords: Coords | null): Scene {
  const box = fixedVpBox(d, pts, coords);
  const out: Scene = box && coords ? volumeProfileScene(box, coords, false) : [];
  if (selected) out.push({ t: "anchors", pts });
  return out;
}

/** Anchored volume profile (TV LineToolAnchoredVolumeProfile, factory
 *  graphics): 1 anchor; profile over the bars from the anchor to the last
 *  bar; histogram drawn from the right edge (right_to_left). */
export function sceneAnchoredVolumeProfile(d: Drawing, pts: Pt[], selected: boolean, coords: Coords | null): Scene {
  const box = anchoredVpBox(d, pts, coords);
  const out: Scene = box && coords ? volumeProfileScene(box, coords, true) : [];
  if (selected) out.push({ t: "anchors", pts: [pts[0]] });
  return out;
}
