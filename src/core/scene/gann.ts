/*
 * Gann tools and the pitchfork family as scenes (moved from OpenTrader
 * DrawingsOverlay, port phase 2): Gann square / square fixed, Gann fan,
 * Gann box, pitchfork (original, Schiff, modified Schiff, inside).
 */
import { bboxCorners, dashFor, HIT_TOLERANCE, type Pt } from "../_shared";
import type { Coords } from "../coords";
import type { Drawing, DrawingStyle } from "../types";
import { GANN_ARC_DEFAULTS, GANN_BOX_LEVEL_DEFAULTS, GANN_FAN_DEFAULTS, GANN_FAN_LEVEL_DEFAULTS, GANN_LEVEL_DEFAULTS, PITCHFORK_LEVEL_DEFAULTS } from "../specs";
import { tvTextLayout } from "../kinds/tv-text";
import { gannArcPaths, gannArcs, gannBox, gannFanLines, gannFrame, gannLevelLines } from "../kinds/gann-square";
import { gannFanDir } from "../kinds/gann-fan";
import { pitchforkExtendRight, pitchforkGeom } from "../kinds/pitchfork";
import type { Scene, SceneItem } from "./types";
import { signedFixed, tvTextItems } from "./text";
import { activeLevels, levelDash, levelFillOpacity, levelWidth } from "./levels";
import { fmtCoeff } from "./fib";

const anchorsIf = (selected: boolean, pts: Pt[]): SceneItem[] => (selected ? [{ t: "anchors", pts }] : []);

/** Gann square / Gann square fixed (TV): level lines, fan lines, arcs (with
 *  ring fills) clipped to the box, then the labels of the Gann square:
 *  price range at (start.x, end.y), bar range at (end.x, start.y), price /
 *  bar ratio at the end (TV text box, last level colour, 10px out). */
export function sceneGannSquare(d: Drawing, pts: Pt[], selected: boolean, s: DrawingStyle, coords: Coords | null): Scene {
  const f = gannFrame(d, pts);
  if (!f) return anchorsIf(selected, pts);
  const levels = s.gannLevels ?? GANN_LEVEL_DEFAULTS;
  const lv = gannLevelLines(f, levels);
  const fans = gannFanLines(f, s.gannFans ?? GANN_FAN_DEFAULTS);
  const arcs = gannArcs(f, s.gannArcs ?? GANN_ARC_DEFAULTS);
  const box = gannBox(f);
  const fillO = s.fillBackground === false ? 0 : Math.max(0, Math.min(1, (100 - (s.transparency ?? 80)) / 100));
  const labels = (() => {
    if (d.kind !== "gann-square" || s.showLabels === false || !coords) return [];
    const [p0, p1] = d.points;
    const i0 = coords.timeToBarIndex(p0.time);
    const i1 = coords.timeToBarIndex(p1.time);
    if (i0 == null || i1 == null) return [];
    const k = s.reverse ? -1 : 1;
    const c = (p1.price - p0.price) * k;
    const u = (i1 - i0) * k;
    const digits = Math.max(0, Math.min(8, Math.round(-Math.log10(coords.pipSize()))));
    const fs = s.labelFontSize ?? 12;
    const mk = (x: number, y: number, text: string, horz: "left" | "right", vert: "top" | "bottom", oy: number) =>
      tvTextLayout({ x, y, text, fs, bold: s.bold, italic: s.italic, horz, vert, offsetX: 10, offsetY: oy });
    const out = [
      mk(f.start.x, f.end.y, signedFixed(c, digits), u > 0 ? "right" : "left", c > 0 ? "bottom" : "top", c > 0 ? 8 : 10),
      mk(f.end.x, f.start.y, String(u), u > 0 ? "left" : "right", c > 0 ? "top" : "bottom", c > 0 ? 10 : 8),
    ];
    if (u !== 0) out.push(mk(f.end.x, f.end.y, String(Number(Math.abs(c / u).toFixed(7))), u > 0 ? "left" : "right", c > 0 ? "bottom" : "top", c > 0 ? 8 : 10));
    return out;
  })();
  const labelColor = levels[levels.length - 1]?.color ?? "#808080";
  const bw = box.right - box.left;
  const bh = box.bottom - box.top;
  const items: SceneItem[] = [
    { t: "clipRect", name: "box", x: box.left, y: box.top, w: bw, h: bh, idPrefix: "gann-clip-" },
    { t: "rect", x: box.left, y: box.top, w: bw, h: bh, fill: "transparent" },
  ];
  for (const l of lv) {
    items.push({ t: "line", a: { x: l.x, y: f.start.y }, b: { x: l.x, y: f.end.y }, stroke: l.color, strokeWidth: l.width, inert: true });
    items.push({ t: "line", a: { x: f.start.x, y: l.y }, b: { x: f.end.x, y: l.y }, stroke: l.color, strokeWidth: l.width, inert: true });
  }
  for (const l of fans) items.push({ t: "line", a: l.from, b: l.to, stroke: l.color, strokeWidth: l.width, cap: "round", inert: true });
  const arcItems: SceneItem[] = [];
  for (const a of arcs) {
    const p = gannArcPaths(f, a.r, a.prev);
    if (fillO > 0) arcItems.push({ t: "path", d: p.fill, fill: a.color, fillOpacity: fillO, stroke: "none" });
    arcItems.push({ t: "path", d: p.stroke, fill: "none", stroke: a.color, strokeWidth: a.width });
  }
  items.push({ t: "group", clip: "box", inert: true, items: arcItems });
  for (const l of labels) items.push(tvTextItems(l, labelColor, s.bold, s.italic));
  items.push(...anchorsIf(selected, pts));
  return items;
}

/** Gann fan (TV module 449964): a ray from p0 through each level's point
 *  (on p1's vertical for c1 > c2, else on p1's horizontal); levels 1-3 fill
 *  toward the next visible ray, levels 5-9 toward the previous one, level 4
 *  (1/2) has no own fill; labels at the level points. */
export function sceneGannFan(pts: Pt[], selected: boolean, w: number, h: number, s: DrawingStyle): Scene {
  const [a, b] = pts;
  const big = (w + h) * 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const levels = (s.levels ?? GANN_FAN_LEVEL_DEFAULTS).map((l, i) => ({ ...l, index: i + 1 })).filter((l) => l.visible);
  const fillO = levelFillOpacity(s);
  const pointOf = (coeff: number): Pt => (coeff > 1 ? { x: b.x, y: a.y + dy / coeff } : { x: a.x + dx * coeff, y: b.y });
  const farOf = (coeff: number): Pt => {
    const v = gannFanDir(a, b, coeff);
    const len = Math.hypot(v.x, v.y) || 1;
    return { x: a.x + (v.x / len) * big, y: a.y + (v.y / len) * big };
  };
  const bands: { from: number; to: number; color: string }[] = [];
  levels.forEach((l, e) => {
    if (l.index < 4 && e < levels.length - 1) bands.push({ from: l.coeff, to: levels[e + 1].coeff, color: l.color });
    else if (l.index > 4 && e > 0) bands.push({ from: l.coeff, to: levels[e - 1].coeff, color: l.color });
  });
  const pad = 12 / 3;
  const items: SceneItem[] = [{ t: "hit", a, b, width: 12 }];
  for (const lvl of levels) items.push({ t: "hit", a, b: farOf(lvl.coeff), width: HIT_TOLERANCE * 2 });
  if (fillO > 0) for (const band of bands) items.push({ t: "polygon", pts: [a, farOf(band.from), farOf(band.to)], fill: band.color, fillOpacity: fillO, stroke: "none", inert: true });
  for (const lvl of levels) {
    const e = farOf(lvl.coeff);
    const t = pointOf(lvl.coeff);
    items.push({ t: "line", a, b: e, stroke: lvl.color, strokeWidth: levelWidth(lvl, s), dash: levelDash(lvl, s) });
    if (s.showLabels !== false) items.push({ t: "text", x: t.x + pad, y: t.y, text: lvl.label ?? fmtCoeff(lvl.coeff), size: 12, fill: lvl.color, anchor: "start", baseline: "central", inert: true });
  }
  items.push(...anchorsIf(selected, pts));
  return items;
}

/** Gann box (TV module 972364): price levels m + coeff·g (lines across the
 *  box, left / right labels, bands between consecutive visible levels in the
 *  upper level colour), time levels at bar round(b + coeff·L) (vertical
 *  lines, top / bottom labels, bands), then the angle lines ("fans", all 7
 *  levels). Reverse swaps the base point. Anchors: the four corners. */
export function sceneGannBox(d: Drawing, pts: Pt[], selected: boolean, s: DrawingStyle, coords: Coords | null): Scene {
  const [a, b] = pts;
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const bottom = Math.max(a.y, b.y);
  const corners = bboxCorners(a, b);
  const hAll = s.levels ?? GANN_BOX_LEVEL_DEFAULTS;
  const vAll = s.vLevels ?? GANN_BOX_LEVEL_DEFAULTS;
  const dash = dashFor(s);
  const [p0, p1] = d.points;
  const rev = !!s.reverse;
  const yOf = (c: number): number => {
    const base = rev ? p1.price : p0.price;
    const span = rev ? p0.price - p1.price : p1.price - p0.price;
    const y = coords?.priceToY(base + c * span);
    return y ?? (rev ? b.y + c * (a.y - b.y) : a.y + c * (b.y - a.y));
  };
  // Time levels (x), snapped to a bar index like TV; linear when unknown.
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
  const hO = s.fillBackground !== false ? Math.max(0, Math.min(1, (100 - (s.transparency ?? 80)) / 100)) : 0;
  const vO = s.fillVertBackground !== false ? Math.max(0, Math.min(1, (100 - (s.vertTransparency ?? 80)) / 100)) : 0;
  const fans = s.fans ?? { visible: false, color: "#9C9C9C" };
  // TV fans: level e's time point from hlevel e's coeff, its price point
  // from vlevel e's coeff.
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
  const label = (x: number, y: number, text: string, color: string, horz: "left" | "center" | "right", vert: "top" | "middle" | "bottom", offsetX: number, offsetY: number) =>
    tvTextItems(tvTextLayout({ x, y, text, fs: 12, horz, vert, offsetX, offsetY }), color);
  const items: SceneItem[] = [{ t: "rect", x: left, y: top, w: Math.max(1, right - left), h: Math.max(1, bottom - top), fill: "transparent" }];
  h.forEach((lv, i) => {
    if (i > 0 && hO > 0) items.push({ t: "rect", x: left, y: Math.min(lv.y, h[i - 1].y), w: right - left, h: Math.abs(lv.y - h[i - 1].y), fill: lv.color, fillOpacity: hO, inert: true });
    items.push({ t: "line", a: { x: left, y: lv.y }, b: { x: right, y: lv.y }, stroke: lv.color, strokeWidth: s.width, dash });
    if (s.showLeftLabels !== false) items.push(label(left, lv.y, fmtCoeff(lv.coeff), lv.color, "right", "middle", 5, 0));
    if (s.showRightLabels !== false) items.push(label(right, lv.y, fmtCoeff(lv.coeff), lv.color, "left", "middle", 5, 0));
  });
  v.forEach((lv, i) => {
    if (i > 0 && vO > 0) items.push({ t: "rect", x: Math.min(lv.x, v[i - 1].x), y: top, w: Math.abs(lv.x - v[i - 1].x), h: bottom - top, fill: lv.color, fillOpacity: vO, inert: true });
    items.push({ t: "line", a: { x: lv.x, y: top }, b: { x: lv.x, y: bottom }, stroke: lv.color, strokeWidth: s.width, dash });
    if (s.showTopLabels !== false) items.push(label(lv.x, top, fmtCoeff(lv.coeff), lv.color, "center", "bottom", 0, 3));
    if (s.showBottomLabels !== false) items.push(label(lv.x, bottom, fmtCoeff(lv.coeff), lv.color, "center", "top", 0, 5));
  });
  for (const [p, q] of fanLines) items.push({ t: "line", a: p, b: q, stroke: fans.color, strokeWidth: s.width, dash, inert: true });
  items.push(...anchorsIf(selected, corners));
  return items;
}

export function scenePitchfork(kind: string, pts: Pt[], selected: boolean, w: number, s: DrawingStyle): Scene {
  const g = pitchforkGeom(kind, pts);
  if (!g) return [];
  const medianFar = pitchforkExtendRight(g.pivot, g.dir, w);
  // TV extendLines: the median and the level lines also run back from their
  // start (extendleft).
  const dl = Math.hypot(g.dir.x, g.dir.y) || 1;
  const back = (p: Pt): Pt => (s.extendLines ? { x: p.x - (g.dir.x / dl) * w * 4, y: p.y - (g.dir.y / dl) * w * 4 } : p);
  const dash = dashFor(s);
  const levels = activeLevels(s, PITCHFORK_LEVEL_DEFAULTS);
  const fillO = levelFillOpacity(s);
  const originOf = (c: number, sign: 1 | -1): Pt => ({ x: g.mid.x + g.half.x * c * sign, y: g.mid.y + g.half.y * c * sign });
  const bands: { from: number; to: number; color: string }[] = [];
  let prev = 0;
  for (const lvl of levels) {
    bands.push({ from: prev, to: lvl.coeff, color: lvl.color });
    prev = lvl.coeff;
  }
  const SIDES: (1 | -1)[] = [1, -1];
  // wide transparent hit lines on the median and every level line
  const items: SceneItem[] = [{ t: "hit", a: g.pivot, b: medianFar, width: HIT_TOLERANCE * 2 }];
  for (const sign of SIDES) for (const lvl of levels) {
    const o = originOf(lvl.coeff, sign);
    items.push({ t: "hit", a: o, b: pitchforkExtendRight(o, g.dir, w), width: HIT_TOLERANCE * 2 });
  }
  if (fillO > 0) {
    for (const sign of SIDES) for (const band of bands) {
      const o0 = originOf(band.from, sign);
      const o1 = originOf(band.to, sign);
      items.push({ t: "polygon", pts: [back(o0), pitchforkExtendRight(o0, g.dir, w), pitchforkExtendRight(o1, g.dir, w), back(o1)], fill: band.color, fillOpacity: fillO, stroke: "none", inert: true });
    }
  }
  // connector p2→p3 (the fork handle), then the median (base colour)
  items.push({ t: "line", a: pts[1], b: pts[2], stroke: s.color, strokeWidth: s.width, dash, cap: "round" });
  items.push({ t: "line", a: back(g.pivot), b: medianFar, stroke: s.color, strokeWidth: s.width, dash, cap: "round" });
  for (const sign of SIDES) for (const lvl of levels) {
    items.push({ t: "line", a: back(originOf(lvl.coeff, sign)), b: pitchforkExtendRight(originOf(lvl.coeff, sign), g.dir, w), stroke: lvl.color, strokeWidth: levelWidth(lvl, s), dash: levelDash(lvl, s), cap: "round" });
  }
  items.push(...anchorsIf(selected, pts));
  return items;
}
