/*
 * Line tools as scenes (moved from OpenTrader DrawingsOverlay, port phase 2):
 * horizontal / vertical / cross line, trend line, ray, extended line,
 * horizontal ray, info line, trend angle, arrow (a trend line with a right
 * end arrow). TradingView geometry: labels (TextRenderer), label cut-outs,
 * line end arrows, middle point, stats box.
 */
import { dashFor, timeToSec, type Pt } from "../_shared";
import type { Coords } from "../coords";
import type { Drawing, DrawingStyle } from "../types";
import { tvTextLayout } from "../kinds/tv-text";
import type { Scene, SceneItem } from "./types";
import { channelLabelCutPoly, channelLabelItems, measureText, signedFixed, textCrossesLine, tvTextItems, tvTimeSpan } from "./text";

/** Square (one-axis) anchor indices per tool, from TV's line-tool bundles
 *  (`lineSourcePaneViewPointToLineAnchorPoint(…, square = true)`). */
export const SQUARE_ANCHORS = {
  rectangle: [4, 5, 6, 7], // edge midpoints (line-tool-rectangle)
  disjointChannel: [2], // offset-edge end at p1.x (line-tool-disjoint-channel)
  parallelChannel: [4, 5], // the two middle anchors (line-tool-parallel-channel)
  position: [1, 2, 3], // close point, stop, target (line-tool-risk-reward)
  single: [0], // horizontal line, vertical line, signpost pole
} as const;

/** TV trend angle arc radius. */
export const TREND_ANGLE_ARC_R = 50;

/** TV stats icons (18 x 18, fill; modules 174588 price range, 567075 bars
 *  range, 521722 angle). */
export const STAT_ICONS: Record<"price" | "bars" | "angle", string> = {
  price: "M3 2h11v1H3V2Zm5.5 1.8.35.35 2 2 .36.35-.71.7-.35-.35L9 5.71v6.58l1.15-1.14.35-.36.7.71-.35.35-2 2-.35.36-.35-.36-2-2-.36-.35.71-.7.35.35L8 12.29V5.71L6.85 6.85l-.35.36-.7-.71.35-.35 2-2 .35-.36ZM3.5 16H3v-1h11v1H3.5Z",
  bars: "M2 3v2H1v9h1v2h1v-2h1V5H3V3H2Zm6.2 4.5-.35.35L6.71 9h4.58l-1.14-1.15-.36-.35.71-.7.35.35 2 2 .36.35-.36.35-2 2-.35.36-.7-.71.35-.35L11.29 10H6.71l1.14 1.15.36.35-.71.7-.35-.35-2-2-.36-.35.36-.35 2-2 .35-.36.7.71ZM3 6H2v7h1V6Zm12-2.5V3h1v2h1v9h-1v2h-1v-2h-1V5h1V3.5ZM15 6h1v7h-1V6Z",
  angle: "M8.55 2.78 2.7 15H15v-1h-4.01a6.2 6.2 0 0 0-1.36-3.95 7.94 7.94 0 0 0-2.57-1.83l2.4-5-.91-.44ZM6.63 9.12 4.29 14H10a5.18 5.18 0 0 0-1.12-3.3 6.93 6.93 0 0 0-2.24-1.58Z",
};

export type StatRow = { icon: "price" | "bars" | "angle"; text: string };

/** TV stats rows of a two-point line tool (price / percent / pips, bars /
 *  date-time / distance, angle), by the style flags. */
export function tvStatRows(d: Drawing, a: Pt, b: Pt, s: DrawingStyle, coords: Coords | null, withExtras: boolean): StatRow[] {
  const p0 = d.points[0];
  const p1 = d.points[1];
  if (!p0 || !p1) return [];
  const rows: StatRow[] = [];
  const dPrice = p1.price - p0.price;
  const pip = coords?.pipSize() ?? 0.01;
  const digits = Math.max(0, Math.min(8, Math.round(-Math.log10(pip))));
  if (s.showPriceRange || s.showPercentPriceRange || s.showPipsPriceRange) {
    const parts: string[] = [];
    if (s.showPriceRange || s.showPercentPriceRange) {
      const sub: string[] = [];
      if (s.showPriceRange) sub.push(signedFixed(dPrice, digits));
      if (s.showPercentPriceRange) {
        const pct = p0.price !== 0 ? `${signedFixed((dPrice / Math.abs(p0.price)) * 100, 2)}%` : "";
        if (pct) sub.push(s.showPriceRange ? `(${pct})` : pct);
      }
      parts.push(sub.join(" "));
    }
    if (s.showPipsPriceRange) parts.push(signedFixed(Math.round(dPrice / pip), 0));
    rows.push({ icon: "price", text: parts.join(", ") });
  }
  const showDate = withExtras && !!s.showDateTimeRange;
  const showDist = withExtras && !!s.showDistance;
  if (s.showBarsRange || showDate || showDist) {
    let t = "";
    if (s.showBarsRange) {
      const i0 = coords ? coords.timeToBarIndex(p0.time) : null;
      const i1 = coords ? coords.timeToBarIndex(p1.time) : null;
      t += `${i0 != null && i1 != null ? i1 - i0 : 0} bars`;
    }
    if (showDate) {
      const aSec = timeToSec(p0.time);
      const bSec = timeToSec(p1.time);
      const span = aSec != null && bSec != null ? tvTimeSpan(bSec - aSec) : "";
      if (span) t += s.showBarsRange ? ` (${span})` : span;
    }
    if (showDist) t += (t ? ", " : "") + `distance: ${Math.round(Math.hypot(b.x - a.x, b.y - a.y))} px`;
    if (t) rows.push({ icon: "bars", text: t });
  }
  if (withExtras && s.showAngle && Math.hypot(b.x - a.x, b.y - a.y) > 0) {
    const deg = (Math.atan2(-(b.y - a.y), b.x - a.x) * 180) / Math.PI;
    rows.push({ icon: "angle", text: `${Math.round(deg * 100) / 100}º` });
  }
  return rows;
}

/** Segment a-b clipped against the rectangle [x, x + rw] x [y, y + rh]
 *  (Liang-Barsky): true when any part lies inside. */
export function segmentHitsRect(a: Pt, b: Pt, x: number, y: number, rw: number, rh: number): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const clip = (p: number, q: number) => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  return clip(-dx, a.x - x) && clip(dx, x + rw - a.x) && clip(-dy, a.y - y) && clip(dy, y + rh - a.y) && t0 <= t1;
}
/** TV Auto visibility: the line (or the single point) touches the pane. */
export function segmentTouchesBox(a: Pt, b: Pt, w: number, h: number): boolean {
  if (a.x === b.x && a.y === b.y) return a.x >= 0 && a.x <= w && a.y >= 0 && a.y <= h;
  return segmentHitsRect(a, b, 0, 0, w, h);
}

/** TV stats box (module 815999 renderer + `_targetRect`): shown while the
 *  drawing is hovered or selected, or always with "Always show stats".
 *  Anchor point by TV statsPosition (0 = p0, 1 = middle, 2 = p1); box at
 *  anchor.x + 12, 12px above the anchor when the line runs up-left or
 *  down-right on screen, else 12px below. Box: font 12, padding 12, 18px
 *  icons + 12px gap, row height 18 + spacing 8, radius 4, background
 *  #464646e6, text #FFFFFF, icons #F9F9F9 (dark theme). */
export function statsBoxItems(a: Pt, b: Pt, rows: StatRow[], position: 0 | 1 | 2 | 3, visible: boolean, w: number, h: number): SceneItem[] {
  if (!visible || rows.length === 0) return [];
  const auto = position === 3;
  // TV Auto: no stats while the line is entirely outside the pane.
  if (auto && !segmentTouchesBox(a, b, w, h)) return [];
  const fs = 12;
  const rowH = 18;
  const gap = 8;
  const pad = 12;
  const textW = Math.max(...rows.map((r) => measureText(r.text, fs)));
  let bw = textW + pad * 2 + rowH + pad;
  if (Math.round(bw) % 2 !== 0) bw = Math.round(bw) + 1;
  const bh = rowH * rows.length + gap * (rows.length - 1) + pad * 2;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const anchor = position === 0 ? a : position === 2 ? b : mid;
  const upLeftOrDownRight = (b.y < a.y && b.x < a.x) || (b.y > a.y && b.x > a.x);
  let x = anchor.x + 12;
  let y = upLeftOrDownRight ? anchor.y - 12 - bh : anchor.y + 12;
  if (auto && (a.x !== b.x || a.y !== b.y)) {
    // TV _targetRect (Auto): keep the box in the pane; when it covers the
    // line, flip it to the other side and put it left of the middle point.
    if (x < 0) x = 0;
    else if (x + bw > w) x = w - bw;
    if (y < 0) y = 0;
    else if (y + bh > h) y = h - bh;
    if (segmentHitsRect(a, b, x, y, bw, bh)) {
      y = upLeftOrDownRight ? mid.y + 12 : mid.y - 12 - bh;
      x = Math.min(mid.x, w) - bw;
    }
  }
  const left = Math.floor(x);
  const top = Math.floor(y);
  const items: SceneItem[] = [{ t: "rect", x: left, y: top, w: bw, h: bh, rx: 4, ry: 4, fill: "#464646", fillOpacity: 0xe6 / 255 }];
  rows.forEach((row, i) => {
    const ry = top + pad + i * (rowH + gap);
    items.push({ t: "path", d: STAT_ICONS[row.icon], transform: `translate(${left + pad}, ${ry})`, fill: "#F9F9F9", fillRule: "evenodd" });
    items.push({ t: "text", x: left + pad + rowH + pad, y: ry + rowH / 2, text: row.text, size: fs, fill: "#FFFFFF", baseline: "central" });
  });
  return [{ t: "group", inert: true, items }];
}

/** TV line end arrow (module 438984 `f` + 937169 getArrowPoints): two
 *  strokes from the tip, 5 x line width back and 5 x line width aside. */
export function rangeArrowPath(from: Pt, tip: Pt, lw: number): string {
  const len = Math.hypot(tip.x - from.x, tip.y - from.y) || 1;
  const ux = (tip.x - from.x) / len;
  const uy = (tip.y - from.y) / len;
  const hl = 5 * lw;
  const bx = tip.x - ux * hl;
  const by = tip.y - uy * hl;
  return `M ${bx - uy * hl} ${by + ux * hl} L ${tip.x} ${tip.y} L ${bx + uy * hl} ${by - ux * hl}`;
}

/** The end arrow drawn in the line's own stroke (colour, width, dash);
 *  nothing under 1px. */
export function endArrowItems(from: Pt, tip: Pt, s: DrawingStyle): SceneItem[] {
  if (Math.hypot(tip.x - from.x, tip.y - from.y) < 1) return [];
  return [{
    t: "path",
    d: rangeArrowPath(from, tip, s.width),
    fill: "none",
    stroke: s.color,
    strokeWidth: s.width,
    dash: dashFor(s),
    join: "round",
    cap: (s.lineStyle ?? "solid") === "solid" ? "round" : "butt",
    inert: true,
  }];
}

/** TV trend line label style: factory centre / bottom, 14px. */
export function trendLabelStyle(s: DrawingStyle): DrawingStyle {
  return { ...s, horzLabelsAlign: s.horzLabelsAlign ?? "center", vertLabelsAlign: s.vertLabelsAlign ?? "bottom" };
}

/** Trend line family label cut-out polygon (TV line-tool-trend-line
 *  `_needLabelExclusionPath`). */
export function trendLabelCutPoly(a: Pt, b: Pt, s: DrawingStyle): Pt[] | null {
  return channelLabelCutPoly(a, b, a, b, trendLabelStyle(s), (s.fontSize ?? 14) / 3, false);
}

/** A cut-out clip item + its name, or none (no polygon). */
function cutOf(name: string, poly: Pt[] | null): { items: SceneItem[]; clip: string | undefined } {
  return poly && poly.length ? { items: [{ t: "clip", name, polys: [poly] }], clip: name } : { items: [], clip: undefined };
}

/** Decorations shared by trend line / ray / extended line / info line: end
 *  arrows, middle point, on-line text, stats box (all by style flags;
 *  geometry from the anchors a, b, not the extended ends). */
export function lineDecorationItems(d: Drawing, a: Pt, b: Pt, s: DrawingStyle, w: number, h: number, coords: Coords | null, active: boolean, clip?: string): SceneItem[] {
  if (!d.points[0] || !d.points[1]) return [];
  const statRows = tvStatRows(d, a, b, s, coords, true);
  // TV factory statsPosition: info line 1 (middle), trend line / ray /
  // extended line 2 (p1).
  const statsPos = s.statsPosition ?? (d.kind === "info-line" ? 1 : 2);
  const showBadge = active || !!s.showStats;
  const items: SceneItem[] = [{
    t: "group",
    clip,
    items: [...(s.leftEnd === 1 ? endArrowItems(b, a, s) : []), ...(s.rightEnd === 1 ? endArrowItems(a, b, s) : [])],
  }];
  // TV: the middle point is an anchor-style marker, shown only while the
  // line is hovered / selected.
  if (s.showMiddlePoint && active) items.push({ t: "anchors", pts: [{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }] });
  items.push(...channelLabelItems(a, b, a, b, trendLabelStyle(s), (s.fontSize ?? 14) / 3));
  items.push(...statsBoxItems(a, b, statRows, statsPos, showBadge, w, h));
  return items;
}

/** TV horizontal line label (line-tool-horizontal-line): at x 3 (Left), the
 *  pane width with a 3px offset (Right) or the pane centre; factory 12px,
 *  centre / middle. Middle cuts the line when the text crosses it. */
export function hLineTextLayout(y: number, pw: number, s: DrawingStyle) {
  if (!s.text) return null;
  const horz = s.horzLabelsAlign ?? "center";
  return tvTextLayout({
    x: horz === "left" ? 3 : horz === "right" ? pw : pw / 2,
    y,
    text: s.text,
    fs: s.fontSize ?? 12,
    bold: s.bold,
    italic: s.italic,
    vert: s.vertLabelsAlign ?? "middle",
    horz,
    offsetX: horz === "right" ? 3 : 0,
  });
}

/** TV horizontal ray label (line-tool-horizontal-ray): Left at the ray start;
 *  Right at the pane edge with a 3px offset, or just past the start when the
 *  box would not fit; Center halfway to the pane edge. Factory 12px, centre /
 *  top. */
export function hRayTextLayout(a: Pt, pw: number, s: DrawingStyle) {
  if (!s.text) return null;
  const horz = s.horzLabelsAlign ?? "center";
  const base = { y: a.y, text: s.text, fs: s.fontSize ?? 12, bold: s.bold, italic: s.italic, vert: s.vertLabelsAlign ?? "top", horz } as const;
  if (horz === "right") {
    const bw = tvTextLayout({ ...base, x: 0 }).box.width;
    return a.x + bw + 3 >= pw ? tvTextLayout({ ...base, x: a.x + bw + 3 }) : tvTextLayout({ ...base, x: pw, offsetX: 3 });
  }
  return tvTextLayout({ ...base, x: horz === "center" ? (a.x + pw) / 2 : a.x });
}

/** Middle cut of a TV line label (`_needLabelExclusionPath`). */
function lineLabelCutPoly(l: ReturnType<typeof tvTextLayout> | null, vert: string): Pt[] | null {
  return l && vert === "middle" && textCrossesLine(l.lines) ? l.poly : null;
}

const hit = (a: Pt, b: Pt): SceneItem => ({ t: "hit", a, b, width: 12 });
const roundCap = (s: DrawingStyle) => ((s.lineStyle ?? "solid") === "solid" ? "round" : "butt") as "round" | "butt";

export function sceneHorizontalLine(pts: Pt[], selected: boolean, w: number, s: DrawingStyle): Scene {
  const a = pts[0];
  const label = hLineTextLayout(a.y, w, s);
  const cut = cutOf("cut", lineLabelCutPoly(label, s.vertLabelsAlign ?? "middle"));
  return [
    hit({ x: 0, y: a.y }, { x: w, y: a.y }),
    ...cut.items,
    { t: "line", a: { x: 0, y: a.y }, b: { x: w, y: a.y }, stroke: s.color, strokeWidth: s.width, dash: dashFor(s), clip: cut.clip },
    ...(label ? [tvTextItems(label, s.textColor ?? s.color, s.bold, s.italic)] : []),
    // TV line-tool-horizontal-line: the anchor sits at 90% of the pane width.
    ...(selected ? [{ t: "anchors" as const, pts: [{ x: 0.9 * w, y: a.y }], squares: SQUARE_ANCHORS.single }] : []),
  ];
}

export function sceneVerticalLine(pts: Pt[], selected: boolean, h: number, s: DrawingStyle): Scene {
  const a = pts[0];
  // TV line-tool-vertical-line, vertical orientation (factory): the text box
  // is turned −90° (reads bottom to top) around a point on the line at the
  // pane height (Top, as TV does), half height (Middle) or 0 (Bottom);
  // box horizontal align Left / Center / Right for Top / Middle / Bottom,
  // vertical align Bottom / Middle / Top for Left / Center / Right.
  // Factory 14px, centre / middle; Middle cuts the line.
  const vert = s.vertLabelsAlign ?? "middle";
  const horz = s.horzLabelsAlign ?? "center";
  const horizontal = s.textOrientation === "horizontal";
  const y = vert === "top" ? h : vert === "middle" ? h / 2 : 0;
  // Horizontal orientation (TV): the box is not turned, 5px from the line
  // (Left = box left of the line, Right = right of it), Top = above the
  // pane bottom, Bottom = below the pane top; the line is cut behind any
  // text.
  const label = !s.text
    ? null
    : horizontal
      ? tvTextLayout({
          x: a.x, y, text: s.text, fs: s.fontSize ?? 14, bold: s.bold, italic: s.italic,
          horz: horz === "left" ? "right" : horz === "right" ? "left" : "center",
          vert: vert === "top" ? "bottom" : vert === "bottom" ? "top" : "middle",
          offsetX: 5,
        })
      : tvTextLayout({
          x: a.x, y, text: s.text, fs: s.fontSize ?? 14, bold: s.bold, italic: s.italic,
          horz: vert === "top" ? "left" : vert === "middle" ? "center" : "right",
          vert: horz === "left" ? "bottom" : horz === "right" ? "top" : "middle",
          angle: -Math.PI / 2,
        });
  // TV `_needLabelExclusionPath`: horizontal = any text; vertical = the
  // Vertical setting (not the turned box).
  const cut = cutOf("cut", horizontal ? (label && s.text?.trim() ? label.poly : null) : lineLabelCutPoly(label, vert));
  return [
    hit({ x: a.x, y: 0 }, { x: a.x, y: h }),
    ...cut.items,
    { t: "line", a: { x: a.x, y: 0 }, b: { x: a.x, y: h }, stroke: s.color, strokeWidth: s.width, dash: dashFor(s), clip: cut.clip },
    ...(label ? [tvTextItems(label, s.textColor ?? s.color, s.bold, s.italic)] : []),
    // TV line-tool-vertical-line: the anchor sits at 90% of the pane height.
    ...(selected ? [{ t: "anchors" as const, pts: [{ x: a.x, y: 0.9 * h }], squares: SQUARE_ANCHORS.single }] : []),
  ];
}

export function sceneCrossLine(pts: Pt[], selected: boolean, w: number, h: number, s: DrawingStyle): Scene {
  const a = pts[0];
  const dash = dashFor(s);
  return [
    hit({ x: 0, y: a.y }, { x: w, y: a.y }),
    hit({ x: a.x, y: 0 }, { x: a.x, y: h }),
    { t: "line", a: { x: 0, y: a.y }, b: { x: w, y: a.y }, stroke: s.color, strokeWidth: s.width, dash },
    { t: "line", a: { x: a.x, y: 0 }, b: { x: a.x, y: h }, stroke: s.color, strokeWidth: s.width, dash },
    ...(selected ? [{ t: "anchors" as const, pts: [a] }] : []),
  ];
}

export function sceneTrendLine(d: Drawing, pts: Pt[], selected: boolean, w: number, h: number, s: DrawingStyle, coords: Coords | null, active: boolean): Scene {
  const [a, b] = pts;
  const cut = cutOf("cut", trendLabelCutPoly(a, b, s));
  return [
    hit(a, b),
    ...cut.items,
    { t: "line", a, b, stroke: s.color, strokeWidth: s.width, dash: dashFor(s), cap: roundCap(s), clip: cut.clip },
    ...lineDecorationItems(d, a, b, s, w, h, coords, active, cut.clip),
    ...(selected ? [{ t: "anchors" as const, pts }] : []),
  ];
}

/** Trend line extended past one or both endpoints to beyond the pane (ray =
 *  end only, extended line = both); the pointer target stays a-b. */
export function sceneExtendedSegment(
  d: Drawing, pts: Pt[], selected: boolean, w: number, h: number, s: DrawingStyle,
  extendStart: boolean, extendEnd: boolean, coords: Coords | null, active: boolean,
): Scene {
  const [a, b] = pts;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const big = (w + h) * 2;
  const start = extendStart ? { x: a.x - ux * big, y: a.y - uy * big } : a;
  const end = extendEnd ? { x: b.x + ux * big, y: b.y + uy * big } : b;
  const cut = cutOf("cut", trendLabelCutPoly(a, b, s));
  return [
    hit(a, b),
    ...cut.items,
    { t: "line", a: start, b: end, stroke: s.color, strokeWidth: s.width, dash: dashFor(s), clip: cut.clip },
    ...lineDecorationItems(d, a, b, s, w, h, coords, active, cut.clip),
    ...(selected ? [{ t: "anchors" as const, pts }] : []),
  ];
}

export function sceneHorizontalRay(pts: Pt[], selected: boolean, w: number, s: DrawingStyle): Scene {
  const a = pts[0];
  const label = hRayTextLayout(a, w, s);
  const cut = cutOf("cut", lineLabelCutPoly(label, s.vertLabelsAlign ?? "top"));
  return [
    hit(a, { x: w, y: a.y }),
    ...cut.items,
    { t: "line", a, b: { x: w, y: a.y }, stroke: s.color, strokeWidth: s.width, dash: dashFor(s), clip: cut.clip },
    ...(label ? [tvTextItems(label, s.textColor ?? s.color, s.bold, s.italic)] : []),
    ...(selected ? [{ t: "anchors" as const, pts: [a] }] : []),
  ];
}

export function sceneInfoLine(d: Drawing, pts: Pt[], selected: boolean, w: number, h: number, s: DrawingStyle, coords: Coords | null, active: boolean): Scene {
  if (d.kind !== "info-line") return [];
  const [a, b] = pts;
  const cut = cutOf("cut", trendLabelCutPoly(a, b, s));
  // Info line = a plain segment whose identity is the stats badge.
  return [
    hit(a, b),
    ...cut.items,
    { t: "line", a, b, stroke: s.color, strokeWidth: s.width, dash: dashFor(s), cap: "round", clip: cut.clip },
    ...lineDecorationItems(d, a, b, s, w, h, coords, active, cut.clip),
    ...(selected ? [{ t: "anchors" as const, pts }] : []),
  ];
}

export function sceneTrendAngle(d: Drawing, pts: Pt[], selected: boolean, w: number, h: number, s: DrawingStyle, coords: Coords | null, active: boolean): Scene {
  const [a, b] = pts;
  const dx = b.x - a.x, dy = b.y - a.y;
  // The readout uses the angle frozen in screen space at placement / last
  // anchor drag (TV `angle` state); older drawings use the live angle.
  const angleDeg = s.angle ?? (Math.atan2(-dy, dx) * 180) / Math.PI;
  const th = (angleDeg * Math.PI) / 180;
  const r = TREND_ANGLE_ARC_R;
  const end = { x: a.x + r * Math.cos(th), y: a.y - r * Math.sin(th) };
  // Canvas arc(0, 0, r, 0, -th, th > 0): upward (sweep 0) for a positive angle.
  const arcPath = `M ${a.x} ${a.y} L ${a.x + r} ${a.y} A ${r} ${r} 0 ${Math.abs(th) > Math.PI ? 1 : 0} ${th > 0 ? 0 : 1} ${end.x} ${end.y}`;
  const fs = s.fontSize ?? 12;
  // TV extendLeft / extendRight: the segment continues to the pane edges.
  const len = Math.hypot(dx, dy) || 1;
  const big = (w + h) * 2;
  const e0 = s.extendLeft ? { x: a.x - (dx / len) * big, y: a.y - (dy / len) * big } : a;
  const e1 = s.extendRight ? { x: b.x + (dx / len) * big, y: b.y + (dy / len) * big } : b;
  return [
    hit(a, b),
    { t: "line", a: e0, b: e1, stroke: s.color, strokeWidth: s.width, dash: dashFor(s), cap: roundCap(s) },
    ...(s.showMiddlePoint && active ? [{ t: "anchors" as const, pts: [{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }] }] : []),
    { t: "path", d: arcPath, fill: "none", stroke: s.color, strokeWidth: 1, dash: "1 2", inert: true },
    {
      t: "text", x: a.x + r + 5 + fs / 3, y: a.y, text: `${Math.round(angleDeg * 100) / 100}º`, size: fs,
      anchor: "start", baseline: "central", weight: s.bold ? 700 : 400, fontStyle: s.italic ? "italic" : "normal", fill: s.color, inert: true,
    },
    // TV TrendToolWithStatsPaneView: price / bars stats (factory off) at the
    // second point (statsPosition 2), on hover / selection / always.
    ...statsBoxItems(a, b, tvStatRows(d, a, b, s, coords, false), s.statsPosition ?? 2, active || !!s.showStats, w, h),
    ...(selected ? [{ t: "anchors" as const, pts }] : []),
  ];
}
