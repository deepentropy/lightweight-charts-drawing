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
import { REGRESSION_LINE_DEFAULTS, volumeProfileStyle } from "../specs";
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
    // Unset = the factory (on, transparency 95), as the dialog shows it.
    if (s.fillBackground !== false && band.index === 0) {
      out.push({ t: "polygon", pts: [...band.upper, ...band.lower.slice().reverse()], fill: s.backgroundColor ?? "#4caf50", fillOpacity: levelFillOpacity({ ...s, transparency: s.transparency ?? 95 }), stroke: "none", inert: true });
    }
    for (const [side, line] of [["upper", band.upper], ["lower", band.lower]] as const) {
      const st = vwapBandLine(s, band.index, side);
      if (st.visible) out.push(...polyPair(line, st.color, st.width));
    }
  }
  out.push(...polyPair(series.line, s.color, s.width, dash), ...badge);
  return out;
}

/** Line dash of a volume profile line style. */
const vpDash = (s: RegressionLine["style"]) => (s === "dashed" ? "6 4" : s === "dotted" ? "2 3" : undefined);

/** Compact volume text ("1.25M", "830K") for the histogram values. */
function vpVolumeText(v: number): string {
  const a = Math.abs(v);
  const f = (x: number, u: string) => `${(v < 0 ? -x : x).toFixed(x >= 100 ? 0 : x >= 10 ? 1 : 2)}${u}`;
  if (a >= 1e9) return f(a / 1e9, "B");
  if (a >= 1e6) return f(a / 1e6, "M");
  if (a >= 1e3) return f(a / 1e3, "K");
  return String(Math.round(v));
}

/** Volume profile (reference VbP study graphics, settings `vp`): the
 *  histogram box, the rows (Up/Down: up then down volume; Total: one bar in
 *  the up colours; Delta: |up − down| in the up or down colour; value area
 *  rows in the value area colours) at `percentWidth` % of the box from the
 *  placement edge, the row values, the VAH / VAL / POC lines across the box
 *  and the developing POC / VA step lines. */
function volumeProfileScene(box: NonNullable<ReturnType<typeof fixedVpBox>>, coords: Coords, d: Drawing): SceneItem[] {
  const s = volumeProfileStyle(d.kind, d.style);
  const { left, right, top, bottom, vp } = box;
  const width = Math.max(1, right - left);
  const histW = (Math.max(0, Math.min(100, s.percentWidth)) / 100) * width;
  const fromRight = s.placement === "right";
  const rowY = (i: number) => {
    const y0 = coords.priceToY(vp.lo + (i + 1) * vp.step) ?? top;
    const y1 = coords.priceToY(vp.lo + i * vp.step) ?? bottom;
    return { y: Math.min(y0, y1), h: Math.abs(y1 - y0) };
  };
  const items: SceneItem[] = [];
  if (s.visible) {
    const max = s.volume === "delta" ? vp.maxDelta : vp.maxTotal;
    const valueSize = 11;
    vp.rows.forEach((row, i) => {
      const r = rowY(i);
      const inVa = i >= vp.vaFrom && i <= vp.vaTo;
      const upColor = inVa ? s.vaUpColor : s.upColor;
      const downColor = inVa ? s.vaDownColor : s.downColor;
      const h = Math.max(1, r.h - 1);
      const scale = (v: number) => (max > 0 ? (v / max) * histW : 0);
      const bars: { w: number; color: string }[] =
        s.volume === "total" ? [{ w: scale(row.up + row.down), color: upColor }]
        : s.volume === "delta" ? [{ w: scale(Math.abs(row.up - row.down)), color: row.up >= row.down ? upColor : downColor }]
        : [{ w: scale(row.up), color: upColor }, { w: scale(row.down), color: downColor }];
      let offset = 0;
      for (const b of bars) {
        const x = fromRight ? right - offset - b.w : left + offset;
        items.push({ t: "rect", x, y: r.y, w: b.w, h, fill: b.color });
        offset += b.w;
      }
      if (s.showValues && r.h >= valueSize - 2) {
        const v = s.volume === "delta" ? row.up - row.down : row.up + row.down;
        items.push({
          t: "text", x: fromRight ? right - offset - 4 : left + offset + 4, y: r.y + r.h / 2, text: vpVolumeText(v),
          size: valueSize, fill: s.valuesColor, anchor: fromRight ? "end" : "start", baseline: "central",
        });
      }
    });
  }
  const priceLine = (price: number, l: RegressionLine) => {
    const y = coords.priceToY(price);
    if (y == null) return;
    items.push({ t: "line", a: { x: left, y }, b: { x: right, y }, stroke: l.color, strokeWidth: l.width, dash: vpDash(l.style) });
  };
  if (s.vah.visible) priceLine(vp.lo + (vp.vaTo + 1) * vp.step, s.vah);
  if (s.val.visible) priceLine(vp.lo + vp.vaFrom * vp.step, s.val);
  if (s.poc.visible) priceLine(vp.lo + (vp.poc + 0.5) * vp.step, s.poc);
  // Developing lines: one step per bar of the range (value up to that bar).
  if (vp.developing) {
    const step = (pick: (p: { poc: number; vah: number; val: number }) => number, l: RegressionLine) => {
      if (!l.visible) return;
      const pts: Pt[] = [];
      for (const p of vp.developing!) {
        const x = coords.timeToX(p.time);
        const y = coords.priceToY(pick(p));
        if (x == null || y == null) continue;
        if (pts.length) pts.push({ x, y: pts[pts.length - 1].y });
        pts.push({ x, y });
      }
      if (pts.length > 1) items.push({ t: "polyline", pts, fill: "none", stroke: l.color, strokeWidth: l.width, dash: vpDash(l.style) });
    };
    step((p) => p.poc, s.developingPoc);
    step((p) => p.vah, s.developingVah);
    step((p) => p.val, s.developingVal);
  }
  return [
    { t: "rect", x: left, y: top, w: width, h: Math.max(1, bottom - top), fill: s.boxColor },
    { t: "group", inert: true, items },
  ];
}

/** Fixed range volume profile (reference LineToolFixedRangeVolumeProfile):
 *  profile over the bars between P0 and P1 (or P0 to the last bar with
 *  Extend Right); box = that time span × the bars' price range. Anchors at
 *  P0 / P1. */
export function sceneFixedRangeVolumeProfile(d: Drawing, pts: Pt[], selected: boolean, coords: Coords | null): Scene {
  const box = fixedVpBox(d, pts, coords);
  const out: Scene = box && coords ? volumeProfileScene(box, coords, d) : [];
  if (selected) out.push({ t: "anchors", pts });
  return out;
}

/** Anchored volume profile (reference LineToolAnchoredVolumeProfile): 1
 *  anchor; profile over the bars from the anchor to the last bar. */
export function sceneAnchoredVolumeProfile(d: Drawing, pts: Pt[], selected: boolean, coords: Coords | null): Scene {
  const box = anchoredVpBox(d, pts, coords);
  const out: Scene = box && coords ? volumeProfileScene(box, coords, d) : [];
  if (selected) out.push({ t: "anchors", pts: [pts[0]] });
  return out;
}
