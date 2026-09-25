/*
 * Range tools as scenes (moved from OpenTrader DrawingsOverlay, port phase
 * 2): price range, date range, date and price range.
 *
 * TV line-tool-price-range / line-tool-date-range pane views (read live from
 * TV 3.4.1 on 24/09/2026). Shared label box (RangeToolsConstants): font 12,
 * text #ffffff on #2E2E2E, corner radius 4, padding horz = fs·0.4 + fs/3 /
 * vert = fs·0.2 + fs/3, line spacing 8, shadow rgba(0,0,0,0.4) blur 4 offset
 * 1; centre placed by calculateLabelPosition (10px past the moving end,
 * flipped / clamped to stay inside the pane). Arrow on the distance line (TV
 * getArrowPoints): open V, 5·lineWidth back and to each side, only when the
 * line is ≥ 15·lineWidth.
 */
import { timeToSec, type Pt } from "../_shared";
import type { Coords } from "../coords";
import type { Drawing, DrawingStyle } from "../types";
import { barsBetween } from "../kinds/data-series";
import type { Scene, SceneItem, Shadow } from "./types";
import { labelBoxPolygon, measureText, signedFixed, textCrossesLine, tvTimeSpan, tvVolume } from "./text";
import { rangeArrowPath } from "./lines";

const RANGE_LABEL_BG = "#2e2e2e";
const RANGE_LABEL_SHADOW: Shadow = { dx: 0, dy: 1, blur: 4, color: "rgba(0,0,0,0.4)" };

/** TV calculateLabelPosition: label centre y for a box of `lh` height. */
function rangeLabelY(a: Pt, b: Pt, lh: number, paneH: number): number {
  const r = lh / 2;
  const off = 10 + r;
  const lo = Math.min(a.y, b.y);
  const hi = Math.max(a.y, b.y);
  let y: number;
  if (a.y > b.y) {
    y = lo - off;
    const over = r - y;
    if (over > 0) {
      const alt = hi + off;
      if (alt + r <= paneH) y = alt;
      else y += over;
    }
  } else {
    y = hi + off;
    const over = y + r - paneH;
    if (over > 0) {
      const alt = lo - off;
      if (alt - r >= 0) y = alt;
      else y -= over;
    }
  }
  return y;
}

/** TV range label text (line-range-tools): the price part (change, " (x%)",
 *  pips, each by its Stats flag) on the first line, then "N bars, span" and
 *  "Vol x"; factory all on. */
export function rangeLabelLines(d: Drawing, s: DrawingStyle, coords: Coords | null, withPrice: boolean, withDate: boolean): string[] {
  const on = (v: boolean | undefined) => v !== false;
  const out: string[] = [];
  const [q0, q1] = d.points;
  if (!q0 || !q1) return out;
  if (withPrice) {
    const p0 = q0.price;
    const p1 = q1.price;
    const change = p1 - p0;
    const pip = coords?.pipSize() ?? 0.01;
    const digits = Math.max(0, Math.min(8, Math.round(-Math.log10(pip))));
    const v = on(s.showPriceRange), pc = on(s.showPercentPriceRange), pp = on(s.showPipsPriceRange);
    let c = "";
    if (v) c += signedFixed(change, digits);
    if (pc) {
      const pct = p0 !== 0 ? (100 * change) / Math.abs(p0) : 0;
      if (v) c += " (";
      c += `${signedFixed(Math.round(pct * 100) / 100, 2)}%`;
      if (v) c += ")";
    }
    if (pp) {
      if (v) c += pc ? " " : ", ";
      else if (pc) c += ", ";
      c += signedFixed(Math.round(change / pip), 0);
    }
    if (c) out.push(c);
  }
  if (withDate) {
    const g = on(s.showBarsRange), f = on(s.showDateTimeRange), x = on(s.showVolume);
    let k = "";
    const t0 = timeToSec(q0.time);
    const t1 = timeToSec(q1.time);
    const i0 = coords?.timeToBarIndex(q0.time) ?? null;
    const i1 = coords?.timeToBarIndex(q1.time) ?? null;
    if (g && i0 != null && i1 != null) k += `${i1 - i0} bars`;
    if (f && t0 != null && t1 != null) {
      if (g) k += ", ";
      k += tvTimeSpan(t1 - t0);
    }
    if (k) out.push(k);
    if (x && coords && t0 != null && t1 != null) {
      const rows = barsBetween(coords.bars(), Math.min(t0, t1), Math.max(t0, t1));
      let vol = 0;
      let any = false;
      for (const r of rows) {
        if (r.volume != null) {
          vol += r.volume;
          any = true;
        }
      }
      if (any) out.push(`Vol ${tvVolume(vol)}`);
    }
  }
  return out;
}

/** The range label box (TV fillLabelBackground: the box + shadow; off = the
 *  text only). */
function rangeLabelItems(cx: number, a: Pt, b: Pt, paneH: number, lines: string[], s: DrawingStyle): SceneItem[] {
  if (!lines.length) return [];
  const fs = s.fontSize ?? 12;
  const padH = fs * 0.4 + fs / 3;
  const padV = fs * 0.2 + fs / 3;
  const boxW = Math.max(...lines.map((l) => measureText(l, fs))) + padH * 2;
  const boxH = fs * lines.length + 8 * (lines.length - 1) + padV * 2;
  const cy = rangeLabelY(a, b, boxH, paneH);
  const items: SceneItem[] = [];
  if (s.fillLabelBackground !== false) {
    items.push({ t: "rect", x: cx - boxW / 2, y: cy - boxH / 2, w: boxW, h: boxH, rx: 4, fill: s.labelBackgroundColor ?? RANGE_LABEL_BG, shadow: RANGE_LABEL_SHADOW });
  }
  lines.forEach((line, i) => {
    items.push({ t: "text", x: cx, y: cy - boxH / 2 + padV + i * (fs + 8) + fs / 2, text: line, size: fs, fill: s.textColor ?? "#ffffff", anchor: "middle", baseline: "central" });
  });
  return [{ t: "group", inert: true, items }];
}

/** Range tools custom text (TV DateAndPriceRangeBasePaneView
 *  `_updateCustomTextRenderer`): centred on the box centre (x = middle of
 *  P0 / P1, y = round((P0.y + P1.y) / 2)), default box padding fs/3, own
 *  colour / size / bold / italic (factory #2962FF, 12px). */
function rangeCustomTextGeom(a: Pt, b: Pt, s: DrawingStyle) {
  const text = s.text ?? "";
  if (text === "") return null;
  const fs = s.customTextSize ?? 12;
  const lines = text.split("\n");
  const lineH = Math.ceil(fs);
  const cy = Math.round((a.y + b.y) / 2);
  return { x: (a.x + b.x) / 2, cy, top: cy - (lines.length * lineH) / 2, lines, lineH, fs };
}

/** Range tools cut (TV `_updateCustomTextRenderer`): the distance lines and
 *  their arrows lose the custom text box (padding fs/3) when the text
 *  crosses them. Returns the clip item (if any) and its name. */
function rangeTextCut(a: Pt, b: Pt, s: DrawingStyle): { items: SceneItem[]; clip: string | undefined } {
  const g = rangeCustomTextGeom(a, b, s);
  if (!g || !textCrossesLine(g.lines)) return { items: [], clip: undefined };
  const pad = g.fs / 3;
  const poly = labelBoxPolygon({ x: g.x, y: g.cy }, 0, g.lines, g.fs, g.lineH, pad, pad, "middle", "center", !!s.customTextBold, !!s.customTextItalic);
  return poly.length ? { items: [{ t: "clip", name: "text", polys: [poly] }], clip: "text" } : { items: [], clip: undefined };
}

function rangeCustomTextItems(a: Pt, b: Pt, s: DrawingStyle): SceneItem[] {
  const g = rangeCustomTextGeom(a, b, s);
  if (!g) return [];
  return g.lines.map((ln, k): SceneItem => ({
    t: "text", x: g.x, y: g.top + k * g.lineH, text: ln, anchor: "middle", baseline: "hanging", size: g.fs,
    weight: s.customTextBold ? 700 : 400, fontStyle: s.customTextItalic ? "italic" : "normal", fill: s.customTextColor ?? "#2962ff", inert: true, pre: true,
  }));
}

function rangeFillOpacity(s: DrawingStyle): number {
  if (s.fillBackground === false) return 0;
  return Math.max(0, Math.min(1, (100 - (s.transparency ?? 85)) / 100));
}

/** The range box fill (transparent when off: still a pointer target). */
function rangeBox(x: number, y: number, w: number, h: number, s: DrawingStyle): SceneItem {
  const fillO = rangeFillOpacity(s);
  return { t: "rect", x, y, w, h, fill: fillO > 0 ? (s.backgroundColor ?? s.color) : "transparent", fillOpacity: fillO > 0 ? fillO : 1 };
}

const edge = (a: Pt, b: Pt, s: DrawingStyle): SceneItem => ({ t: "line", a, b, stroke: s.color, strokeWidth: s.width, cap: "round" });
const arrow = (from: Pt, tip: Pt, s: DrawingStyle): SceneItem => ({
  t: "path", d: rangeArrowPath(from, tip, s.width), fill: "none", stroke: s.color, strokeWidth: s.width, cap: "round", join: "round",
});

/** Box, distance lines (+ arrows) cut behind the custom text, label, custom
 *  text, anchors. */
function rangeScene(box: SceneItem[], distance: SceneItem[], a: Pt, b: Pt, pts: Pt[], selected: boolean, h: number, s: DrawingStyle, lines: string[]): Scene {
  const cut = rangeTextCut(a, b, s);
  const out: Scene = [
    ...cut.items,
    ...box,
    { t: "group", clip: cut.clip, items: distance },
    ...rangeLabelItems((a.x + b.x) / 2, a, b, h, lines, s),
    ...rangeCustomTextItems(pts[0], pts[1], s),
  ];
  if (selected) out.push({ t: "anchors", pts });
  return out;
}

export function scenePriceRange(d: Drawing, pts: Pt[], selected: boolean, w: number, h: number, s: DrawingStyle, coords: Coords | null): Scene {
  if (d.kind !== "price-range") return [];
  const [a, b] = pts;
  const left = s.extendLeft ? 0 : Math.min(a.x, b.x);
  const right = s.extendRight ? w : Math.max(a.x, b.x);
  const midX = Math.round((a.x + b.x) / 2);
  // Label: price change (price precision), percent (2 decimals), pips.
  const lines = rangeLabelLines(d, s, coords, true, false);
  const distance: SceneItem[] = [edge({ x: midX, y: a.y }, { x: midX, y: b.y }, s)];
  if (Math.abs(b.y - a.y) >= 15 * s.width) distance.push(arrow({ x: midX, y: a.y }, { x: midX, y: b.y }, s));
  const box = [
    rangeBox(left, Math.min(a.y, b.y), Math.max(1, right - left), Math.abs(b.y - a.y), s),
    edge({ x: left, y: a.y }, { x: right, y: a.y }, s),
    edge({ x: left, y: b.y }, { x: right, y: b.y }, s),
  ];
  return rangeScene(box, distance, a, b, pts, selected, h, s, lines);
}

export function sceneDateRange(d: Drawing, pts: Pt[], selected: boolean, h: number, s: DrawingStyle, coords: Coords | null): Scene {
  if (d.kind !== "date-range") return [];
  const [a, b] = pts;
  // TV extendTop / extendBottom: the box and both borders to the pane edge.
  const top = s.extendTop ? 0 : Math.min(a.y, b.y);
  const bottom = s.extendBottom ? h : Math.max(a.y, b.y);
  const midY = Math.round((a.y + b.y) / 2);
  // Label: "{n} bars, {span}" then "Vol {volume}" (TV showBarsRange /
  // showDateTimeRange / showVolume, all on by default).
  const lines = rangeLabelLines(d, s, coords, false, true);
  const distance: SceneItem[] = [edge({ x: a.x, y: midY }, { x: b.x, y: midY }, s)];
  if (Math.abs(b.x - a.x) >= 15 * s.width) distance.push(arrow({ x: a.x, y: midY }, { x: b.x, y: midY }, s));
  const box = [
    rangeBox(Math.min(a.x, b.x), top, Math.max(1, Math.abs(b.x - a.x)), Math.max(1, bottom - top), s),
    edge({ x: a.x, y: top }, { x: a.x, y: bottom }, s),
    edge({ x: b.x, y: top }, { x: b.x, y: bottom }, s),
  ];
  return rangeScene(box, distance, a, b, pts, selected, h, s, lines);
}

export function sceneDateAndPriceRange(d: Drawing, pts: Pt[], selected: boolean, h: number, s: DrawingStyle, coords: Coords | null): Scene {
  if (d.kind !== "date-and-price-range") return [];
  // TV line-tool-date-and-price-range pane view: filled P0-P1 box (border
  // only with drawBorder, off by default), a horizontal and a vertical
  // distance line through the middle, each with an arrow at the P1 end when
  // ≥ 25·lineWidth long, and the range label (price line, then "bars, span",
  // then "Vol") placed like the other range tools.
  const [a, b] = pts;
  const midY = Math.round((a.y + b.y) / 2);
  const midX = Math.round((a.x + b.x) / 2);
  const lines = rangeLabelLines(d, s, coords, true, true);
  // TV drawBorder: the box border (borderColor, borderWidth); the distance
  // lines then start borderWidth / 2 inside it.
  const bw = s.drawBorder ? s.borderWidth ?? 1 : 0;
  const o = bw / 2;
  const hx0 = a.x + Math.sign(b.x - a.x) * o, hx1 = b.x + Math.sign(a.x - b.x) * o;
  const vy0 = a.y + Math.sign(b.y - a.y) * o, vy1 = b.y + Math.sign(a.y - b.y) * o;
  const box: SceneItem[] = [rangeBox(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(1, Math.abs(b.x - a.x)), Math.max(1, Math.abs(b.y - a.y)), s)];
  if (bw > 0) {
    box.push({ t: "rect", x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y), fill: "none", stroke: s.borderColor ?? s.color, strokeWidth: bw });
  }
  const distance: SceneItem[] = [
    edge({ x: hx0, y: midY }, { x: hx1, y: midY }, s),
    edge({ x: midX, y: vy0 }, { x: midX, y: vy1 }, s),
  ];
  if (Math.abs(b.x - a.x) >= 25 * s.width) distance.push(arrow({ x: hx0, y: midY }, { x: hx1, y: midY }, s));
  if (Math.abs(b.y - a.y) >= 25 * s.width) distance.push(arrow({ x: midX, y: vy0 }, { x: midX, y: vy1 }, s));
  return rangeScene(box, distance, a, b, pts, selected, h, s, lines);
}
