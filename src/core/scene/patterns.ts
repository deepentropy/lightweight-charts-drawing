/*
 * Patterns, Elliott waves and the plain polyline family as scenes (moved from
 * OpenTrader DrawingsOverlay, port phase 2): XABCD, Cypher, ABCD, three
 * drives, triangle pattern, head and shoulders, Elliott impulse / correction
 * / triangle / double combo / triple combo, polyline, path, brush,
 * highlighter.
 */
import { dashFor, HIT_TOLERANCE, type Pt } from "../_shared";
import type { Drawing, DrawingStyle } from "../types";
import { ELLIOTT_DEFAULT_DEGREE } from "../specs";
import { measureTextStyled } from "../kinds/tv-text";
import type { Scene, SceneItem } from "./types";
import { levelFillOpacity } from "./levels";
import { rangeArrowPath } from "./lines";

/** Per-kind vertex labels — order matches stored-point order (the Nth click
 *  gets the Nth label). */
export const KIND_LABELS: Record<string, readonly string[]> = {
  "xabcd-pattern": ["X", "A", "B", "C", "D"],
  "cypher-pattern": ["X", "A", "B", "C", "D"],
  "abcd-pattern": ["A", "B", "C", "D"],
  // 7 points (TV): labels only at the left shoulder / head / right shoulder.
  "head-and-shoulders": ["", "LS", "", "H", "", "RS", ""],
  "triangle-pattern": ["A", "B", "C", "D"],
  "three-drives-pattern": ["1", "2", "3", "4", "5", "6", "7"],
  // Elliott label sets start at "0" (TV; the first click is the wave origin).
  "elliott-impulse": ["0", "1", "2", "3", "4", "5"],
  "elliott-correction": ["0", "A", "B", "C"],
  "elliott-triangle": ["0", "A", "B", "C", "D", "E"],
  "elliott-double-combo": ["0", "W", "X", "Y"],
  "elliott-triple-combo": ["0", "W", "X", "Y", "X", "Z"],
};

/** Kinds whose polyline closes into a filled polygon. (TV: abcd has NO fill;
 *  triangle-pattern fills only the convergence wedge and xabcd/cypher only
 *  their two triangles — custom-rendered.) */
const FILLED_KINDS = new Set<string>([
  "polyline",
]);

/** Elliott waves (TV line-tool-elliott, module 910357). Degree 0
 *  (Supermillennium) … 14 (Minuscule), factory 7 (Intermediate). With
 *  t = 14 − degree: label group = floor(t / 3), decoration = none / brackets /
 *  circle by t % 3. Group styles (font / circle / bold): 0 = 11 / 14 / bold,
 *  1 = 16 / 22, 2 = 18 / 22, 3 = 20 / 28, 4 = 24 / 36 / bold; circle border
 *  1px. Label sets: impulse 1-5, i-v, 1-5, I-V, 1-5; the letter waves
 *  upper / lower / upper / lower / upper. Label centred yOffset 10 + half the
 *  circle size off each point, in the wave colour at full opacity; the side
 *  alternates along the wave, starting from the sign of p2.y − p1.y (1 =
 *  below). The "0" origin label shows only while the anchors do (hover /
 *  selection). */
const ELLIOTT_GROUP_STYLE: { font: number; circle: number; bold: boolean }[] = [
  { font: 11, circle: 14, bold: true },
  { font: 16, circle: 22, bold: false },
  { font: 18, circle: 22, bold: false },
  { font: 20, circle: 28, bold: false },
  { font: 24, circle: 36, bold: true },
];
const ELLIOTT_BASE_LABELS: Record<string, string[]> = {
  "elliott-impulse": ["0", "1", "2", "3", "4", "5"],
  "elliott-correction": ["0", "A", "B", "C"],
  "elliott-triangle": ["0", "A", "B", "C", "D", "E"],
  "elliott-double-combo": ["0", "W", "X", "Y"],
  "elliott-triple-combo": ["0", "W", "X", "Y", "X", "Z"],
};
const ROMAN = ["0", "i", "ii", "iii", "iv", "v"];
function elliottLabels(kind: string, group: number): string[] {
  const base = ELLIOTT_BASE_LABELS[kind] ?? [];
  if (kind === "elliott-impulse") {
    if (group === 1) return ROMAN;
    if (group === 3) return ROMAN.map((r) => r.toUpperCase());
    return base;
  }
  return group % 2 === 1 ? base.map((l) => l.toLowerCase()) : base;
}

export function sceneElliott(d: Drawing, pts: Pt[], selected: boolean, s: DrawingStyle): Scene {
  const degree = Math.max(0, Math.min(14, Math.round(s.elliottDegree ?? ELLIOTT_DEFAULT_DEGREE)));
  const t = 14 - degree;
  const group = Math.floor(t / 3);
  const deco = (["", "brackets", "circle"] as const)[t % 3];
  const gs = ELLIOTT_GROUP_STYLE[group];
  const labels = elliottLabels(d.kind, group);
  const offset = 10 + gs.circle / 2;
  const start = pts.length > 2 ? Math.sign(pts[2].y - pts[1].y) : 1;
  const side = (i: number) => (i % 2 === 0 ? start : -start);
  const out: Scene = [{ t: "polyline", pts, fill: "none", stroke: "transparent", strokeWidth: Math.max(HIT_TOLERANCE * 2, s.width) }];
  if (s.showWave !== false) {
    out.push({ t: "polyline", pts, fill: "none", stroke: s.color, strokeWidth: s.width, dash: dashFor(s), join: "round", cap: "round" });
  }
  pts.forEach((pt, i) => {
    if (i === 0 && !selected) return;
    const cy = pt.y + (side(i) === 1 ? offset : -offset);
    const l = labels[i] ?? String(i);
    if (deco === "circle") out.push({ t: "circle", cx: pt.x, cy, r: gs.circle / 2 - 0.5, fill: "none", stroke: s.color, strokeWidth: 1, inert: true });
    out.push({
      t: "text", x: pt.x, y: cy + 0.05 * gs.font, text: deco === "brackets" ? `(${l})` : l, size: gs.font,
      weight: gs.bold ? 700 : 400, fill: s.color, anchor: "middle", baseline: "central", inert: true,
    });
  });
  if (selected) out.push({ t: "anchors", pts });
  return out;
}

/** Label y-offset: above local peaks, below local troughs (TV places pattern
 *  letters on the outside of the zigzag). */
function labelOffsetY(pts: Pt[], i: number): number {
  const prev = pts[i - 1] ?? pts[i + 1] ?? pts[i];
  const next = pts[i + 1] ?? pts[i - 1] ?? pts[i];
  const isPeak = pts[i].y <= Math.min(prev.y, next.y);
  return isPeak ? -8 : 16;
}

type PillText = { bg: string; fg: string; fontSize: number; bold?: boolean; italic?: boolean };

/** Vertex/ratio label pill (TV TextRenderer data used across the pattern pane
 *  views: white text on the tool colour, backgroundRoundRect 4). `dy` places
 *  the pill above (<0) or below (>0) the anchor; 0 centers it on the point. */
function patternPill(x: number, y: number, dy: number, text: string, p: PillText): SceneItem {
  const w = text.length * p.fontSize * 0.62 + 8;
  const h = p.fontSize + 6;
  const top = dy < 0 ? y + dy - h : dy > 0 ? y + dy : y - h / 2;
  return {
    t: "group",
    inert: true,
    items: [
      { t: "rect", x: x - w / 2, y: top, w, h, rx: 4, fill: p.bg },
      {
        t: "text", x, y: top + h / 2 + 0.5, text, size: p.fontSize, weight: p.bold ? 700 : 400, fontStyle: p.italic ? "italic" : "normal",
        fill: p.fg, anchor: "middle", baseline: "middle",
      },
    ],
  };
}

/** "0.618"-style retracement value: |(c−b)/(b−a)| by price, rounded to
 *  `decimals` (TV rounds abcd/xabcd to 3, three-drives to 2). */
function retracement(a: number, b: number, c: number, decimals: number): string {
  const denom = b - a;
  if (Math.abs(denom) < 1e-12) return "∞";
  const f = Math.pow(10, decimals);
  return String(Math.round((Math.abs((c - b) / denom)) * f) / f);
}

/** Dotted retracement connector (TV TrendLineRenderer, LINESTYLE_DOTTED). */
function patternConnector(a: Pt, b: Pt, color: string, width: number): SceneItem[] {
  return [
    { t: "hit", a, b, width: HIT_TOLERANCE * 2 },
    { t: "line", a, b, stroke: color, strokeWidth: width, dash: "2 3" },
  ];
}

/** A connector i→j with its ratio pill at the midpoint. */
function ratioLeg(pts: Pt[], i: number, j: number, width: number, text: string, p: PillText): SceneItem[] {
  return [
    ...patternConnector(pts[i], pts[j], p.bg, width),
    patternPill((pts[i].x + pts[j].x) / 2, (pts[i].y + pts[j].y) / 2, 0, text, p),
  ];
}

const pillText = (s: DrawingStyle): PillText => ({ bg: s.color, fg: s.textColor ?? "#ffffff", fontSize: s.fontSize ?? 12, bold: s.bold, italic: s.italic });

/** Letter pills at each vertex, above local peaks / below troughs (the chunks
 *  flip vertAlign per segment direction; the local-extremum rule matches for
 *  zigzag patterns). */
function patternLetterPills(pts: Pt[], labels: readonly string[], s: DrawingStyle): SceneItem[] {
  const p = pillText(s);
  const out: SceneItem[] = [];
  pts.forEach((pt, i) => {
    if (labels[i]) out.push(patternPill(pt.x, pt.y, labelOffsetY(pts, i) < 0 ? -5 : 5, labels[i], p));
  });
  return out;
}

const hitPolyline = (pts: Pt[]): SceneItem => ({ t: "polyline", pts, fill: "none", stroke: "transparent", strokeWidth: HIT_TOLERANCE * 2 });

/** ABCD pattern (line-tool-abcd): solid A-B-C-D polyline, DOTTED connectors
 *  A→C and B→D carrying the retracement ratio at their midpoints —
 *  |(C−B)/(B−A)| and |(D−C)/(C−B)| by price, 3 decimals — plus letter pills.
 *  No polygon fill (TV renders it unfilled). */
export function sceneAbcdPattern(d: Drawing, pts: Pt[], selected: boolean, s: DrawingStyle): Scene {
  const p = pillText(s);
  const prices = d.points.map((q) => q.price);
  const out: Scene = [
    hitPolyline(pts),
    { t: "polyline", pts, fill: "none", stroke: s.color, strokeWidth: s.width, dash: dashFor(s), join: "round" },
  ];
  if (pts.length >= 3) out.push(...ratioLeg(pts, 0, 2, s.width, retracement(prices[0], prices[1], prices[2], 3), p));
  if (pts.length >= 4) out.push(...ratioLeg(pts, 1, 3, s.width, retracement(prices[1], prices[2], prices[3], 3), p));
  out.push(...patternLetterPills(pts, KIND_LABELS[d.kind]!, s));
  if (selected) out.push({ t: "anchors", pts });
  return out;
}

/** XABCD / Cypher (line-tool-5points-patterns): the X-A-B and B-C-D triangles
 *  fill with the translucent background colour (factory transparency 85), the
 *  X-A-B-C-D polyline stays solid, and four DOTTED connectors (X→B, A→C, X→D,
 *  B→D, 1px) carry midpoint ratio pills. Ratio formulas per chunk (cypher
 *  overrides the bc/xd legs — LineToolCypherPattern `_updateBaseData`). */
export function sceneXabcdPattern(d: Drawing, pts: Pt[], selected: boolean, s: DrawingStyle): Scene {
  const cypher = d.kind === "cypher-pattern";
  const p = pillText(s);
  const fill = s.backgroundColor ?? s.color;
  const fillO = s.fillBackground === false ? 0 : levelFillOpacity(s);
  const pr = d.points.map((q) => q.price);
  const out: Scene = [];
  if (fillO > 0 && pts.length >= 3) out.push({ t: "polygon", pts: [pts[0], pts[1], pts[2]], fill, fillOpacity: fillO, stroke: "none" });
  if (fillO > 0 && pts.length >= 5) out.push({ t: "polygon", pts: [pts[2], pts[3], pts[4]], fill, fillOpacity: fillO, stroke: "none" });
  out.push(hitPolyline(pts), { t: "polyline", pts, fill: "none", stroke: s.color, strokeWidth: s.width, dash: dashFor(s), join: "round" });
  // Ratio legs: xabcd vs cypher formulas from the decompiled `_updateBaseData`
  // pairs (X A B C D = points 0..4).
  if (pts.length >= 3) out.push(...ratioLeg(pts, 0, 2, 1, retracement(pr[0], pr[1], pr[2], 3), p));
  if (pts.length >= 4) out.push(...ratioLeg(pts, 1, 3, 1, cypher ? retracement(pr[1], pr[0], pr[3], 3) : retracement(pr[1], pr[2], pr[3], 3), p));
  if (pts.length >= 5) {
    // cypher xd leg = |(D−C)/(X−C)|; xabcd xd = |(D−A)/(A−X)|.
    const xd = cypher ? retracement(pr[0], pr[2], pr[4], 3) : retracement(pr[0], pr[1], pr[4], 3);
    out.push(
      ...patternConnector(pts[0], pts[4], s.color, 1),
      ...patternConnector(pts[2], pts[4], s.color, 1),
      patternPill((pts[2].x + pts[4].x) / 2, (pts[2].y + pts[4].y) / 2, 0, retracement(pr[2], pr[3], pr[4], 3), p),
      patternPill((pts[0].x + pts[4].x) / 2, (pts[0].y + pts[4].y) / 2, 0, xd, p),
    );
  }
  out.push(...patternLetterPills(pts, KIND_LABELS[d.kind]!, s));
  if (selected) out.push({ t: "anchors", pts });
  return out;
}

/** Three drives (line-tool-three-drivers): 7-point solid polyline; DOTTED
 *  connectors p1→p3 and p3→p5 with the retracements |(p3−p2)/(p2−p1)| and
 *  |(p5−p4)/(p4−p3)| (2 decimals) at their midpoints. TV renders no vertex
 *  letters on this tool. */
export function sceneThreeDrives(d: Drawing, pts: Pt[], selected: boolean, s: DrawingStyle): Scene {
  const p = pillText(s);
  const pr = d.points.map((q) => q.price);
  const out: Scene = [
    hitPolyline(pts),
    { t: "polyline", pts, fill: "none", stroke: s.color, strokeWidth: s.width, dash: dashFor(s), join: "round" },
  ];
  if (pts.length >= 4) out.push(...ratioLeg(pts, 1, 3, s.width, retracement(pr[1], pr[2], pr[3], 2), p));
  if (pts.length >= 6) out.push(...ratioLeg(pts, 3, 5, s.width, retracement(pr[3], pr[4], pr[5], 2), p));
  if (selected) out.push({ t: "anchors", pts });
  return out;
}

/** Head-and-shoulders / triangle pattern pill (white text on the tool colour,
 *  radius 4, padding fs/3), 5px above or below the point. */
function hnsPill(pt: Pt, above: boolean, text: string, p: PillText): SceneItem {
  const pad = p.fontSize / 3;
  const w = measureTextStyled(text, p.fontSize, !!p.bold, !!p.italic) + 2 * pad;
  const h = p.fontSize + 2 * pad;
  const top = above ? pt.y - 5 - h : pt.y + 5;
  return {
    t: "group",
    inert: true,
    items: [
      { t: "rect", x: pt.x - w / 2, y: top, w, h, rx: 4, fill: p.bg },
      {
        t: "text", x: pt.x, y: top + h / 2, text, size: p.fontSize, weight: p.bold ? 700 : 400, fontStyle: p.italic ? "italic" : "normal",
        fill: p.fg, anchor: "middle", baseline: "central",
      },
    ],
  };
}

/** Triangle pattern (TV line-tool-triangle-pattern): solid legs A-B, B-C,
 *  C-D; the two edges (line A-C and line B-D) drawn from the leftmost point
 *  (rightmost when they converge to the left) to their crossing, as a
 *  dotted-outline triangle with the background fill; letter pills A-D (white
 *  text on the tool colour, radius 4, padding fs/3) 5px above / below each
 *  point by the direction of the neighbouring leg. */
export function sceneTrianglePattern(pts: Pt[], selected: boolean, s: DrawingStyle): Scene {
  const [t, n, r, i] = pts;
  const p = pillText(s);
  let tri: Pt[] | null = null;
  if (Math.abs(r.x - t.x) >= 1 && Math.abs(i.x - n.x) >= 1) {
    const o = (r.y - t.y) / (r.x - t.x);
    const h = (i.y - n.y) / (i.x - n.x);
    if (Math.abs(o - h) >= 1e-6) {
      let e = Math.min(t.x, n.x, r.x, i.x);
      let l = { x: e, y: t.y + (e - t.x) * o };
      let a = { x: e, y: n.y + (e - n.x) * h };
      const px = (n.y - t.y + (t.x * o - n.x * h)) / (o - h);
      if (px < e) {
        e = Math.max(t.x, n.x, r.x, i.x);
        l = { x: e, y: t.y + (e - t.x) * o };
        a = { x: e, y: n.y + (e - n.x) * h };
      }
      tri = [l, a, { x: px, y: t.y + (px - t.x) * o }];
    }
  }
  const out: Scene = [hitPolyline(pts)];
  if (tri) {
    out.push({
      t: "polygon", pts: tri, fill: s.fillBackground === false ? "none" : (s.backgroundColor ?? s.color), fillOpacity: levelFillOpacity(s) || 0.15,
      stroke: s.color, strokeWidth: s.width, dash: dashFor({ ...s, lineStyle: "dotted" }), inert: true,
    });
  }
  out.push(
    { t: "polyline", pts, fill: "none", stroke: s.color, strokeWidth: s.width, join: "round" },
    hnsPill(t, n.y > t.y, "A", p),
    hnsPill(n, n.y < t.y, "B", p),
    hnsPill(r, r.y < n.y, "C", p),
    hnsPill(i, i.y < r.y, "D", p),
  );
  if (selected) out.push({ t: "anchors", pts });
  return out;
}

/** Intersection of the infinite line a-b with the segment c-d. */
function lineSegmentHit(a: Pt, b: Pt, c: Pt, d: Pt): Pt | null {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-9) return null;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
  if (u < 0 || u > 1) return null;
  return { x: c.x + s.x * u, y: c.y + s.y * u };
}

/** Head and shoulders (TV line-tool-head-and-shoulders): polyline through the
 *  7 points; dotted neckline through the troughs p2-p4, cut where it meets
 *  the first leg (p0-p1) and the last leg (p5-p6), extended to the troughs'
 *  side when a leg is not reached; fills of the head triangle (p2, p3, p4)
 *  and of the two shoulder triangles closed by the neckline; pill labels
 *  "Left Shoulder" / "Head" / "Right Shoulder" 5px above the peak (below for
 *  an inverted one). */
export function sceneHeadAndShoulders(pts: Pt[], selected: boolean, s: DrawingStyle): Scene {
  const fillO = levelFillOpacity(s) || 0.15;
  const fill = s.backgroundColor ?? s.color;
  const [p0, p1, p2, p3, p4, p5, p6] = pts;
  const i1 = lineSegmentHit(p2, p4, p0, p1);
  const i2 = lineSegmentHit(p2, p4, p5, p6);
  // Neckline ends: the intersections, else extend from the trough outward.
  const far = (from: Pt, toward: Pt): Pt => ({ x: from.x + (toward.x - from.x) * 10, y: from.y + (toward.y - from.y) * 10 });
  const p = pillText(s);
  const tri = (a: Pt, b: Pt, c: Pt): SceneItem => ({ t: "polygon", pts: [a, b, c], fill, fillOpacity: fillO, stroke: "none", inert: true });
  const out: Scene = [hitPolyline(pts)];
  if (s.fillBackground !== false) {
    out.push(tri(p2, p3, p4));
    if (i1) out.push(tri(i1, p1, p2));
    if (i2) out.push(tri(p4, p5, i2));
  }
  out.push(
    { t: "line", a: i1 ?? far(p4, p2), b: i2 ?? far(p2, p4), stroke: s.color, strokeWidth: s.width, dash: dashFor({ ...s, lineStyle: "dotted" }), inert: true },
    { t: "polyline", pts, fill: "none", stroke: s.color, strokeWidth: s.width, dash: dashFor(s), join: "round" },
    hnsPill(p1, p1.y < p0.y, "Left Shoulder", p),
    hnsPill(p3, p3.y < p2.y, "Head", p),
    hnsPill(p5, p5.y < p4.y, "Right Shoulder", p),
  );
  if (selected) out.push({ t: "anchors", pts });
  return out;
}

/** TV brush smoothing (line-tool-brush pane view, smooth = 5, also used by
 *  the highlighter): resample each segment into up to 5 parts (step ≥ smooth
 *  px), then a moving average over 2·smooth samples, then repeat the last
 *  point. Screen space, recomputed on every render like TV. */
export function smoothBrush(pts: Pt[], smooth = 5): Pt[] {
  if (pts.length < 2) return pts;
  const t = Math.max(1, smooth);
  const r: Pt[] = [pts[0]];
  for (let e = 1; e < pts.length; e++) {
    const dx = pts[e].x - pts[e - 1].x;
    const dy = pts[e].y - pts[e - 1].y;
    const len = Math.hypot(dx, dy);
    const o = Math.min(5, Math.floor(len / t));
    for (let k = 0; k < o - 1; k++) r.push({ x: pts[e - 1].x + (dx / o) * k, y: pts[e - 1].y + (dy / o) * k });
    r.push(pts[e]);
  }
  const out: Pt[] = new Array(r.length);
  for (let i = 0; i < r.length; i++) {
    let sx = 0;
    let sy = 0;
    for (let k = 0; k < t; k++) {
      const a = r[Math.max(i - k, 0)];
      const b = r[Math.min(i + k, r.length - 1)];
      sx += a.x + b.x;
      sy += a.y + b.y;
    }
    out[i] = { x: (sx * 0.5) / t, y: (sy * 0.5) / t };
  }
  out.push(r[r.length - 1]);
  return out;
}

/** Labeled polyline / polygon through N vertices (polyline, path, brush,
 *  highlighter, and the pattern / Elliott tools, which get their own scene
 *  once they have enough points), with a per-kind label at each vertex.
 *  Filled kinds close into a translucent polygon; the highlighter paints a
 *  wide semi-transparent marker stroke. */
export function sceneLabeledPolyline(d: Drawing, pts: Pt[], selected: boolean, s: DrawingStyle): Scene {
  if (d.kind === "triangle-pattern" && pts.length >= 4) return sceneTrianglePattern(pts, selected, s);
  if (d.kind === "head-and-shoulders" && pts.length >= 7) return sceneHeadAndShoulders(pts, selected, s);
  if (d.kind === "abcd-pattern" && pts.length >= 2) return sceneAbcdPattern(d, pts, selected, s);
  if ((d.kind === "xabcd-pattern" || d.kind === "cypher-pattern") && pts.length >= 2) return sceneXabcdPattern(d, pts, selected, s);
  if (d.kind === "three-drives-pattern" && pts.length >= 2) return sceneThreeDrives(d, pts, selected, s);
  if (d.kind.startsWith("elliott-")) return sceneElliott(d, pts, selected, s);
  const labels = KIND_LABELS[d.kind];
  // TV polyline: the closing side and the fill only once closed (`filled`).
  const isFilled = FILLED_KINDS.has(d.kind) && d.closed === true;
  const isHighlighter = d.kind === "highlighter";
  // Freehand strokes (brush/highlighter) are densely sampled, so they show only
  // endpoint handles when selected (not one per vertex) and always paint solid.
  const isFreehand = d.kind === "brush" || isHighlighter;
  const strokeW = isHighlighter ? Math.max(s.width, 12) : s.width;
  // TV smooths brush / highlighter strokes on every render (smooth = 5).
  const drawPts = isFreehand ? smoothBrush(pts) : pts;
  const dash = isFreehand ? undefined : dashFor(s);
  const handlePts = isFreehand && pts.length > 1 ? [pts[0], pts[pts.length - 1]] : pts;
  const out: Scene = [];
  if (isFilled) {
    const fill = s.backgroundColor ?? s.color;
    const fillOpacity = s.fillBackground !== undefined ? levelFillOpacity(s) : 0.08;
    out.push(
      { t: "polygon", pts: drawPts, fill, fillOpacity, stroke: "transparent", strokeWidth: HIT_TOLERANCE * 2 },
      { t: "polygon", pts: drawPts, fill, fillOpacity, stroke: s.color, strokeWidth: s.width, dash, join: "round" },
    );
  } else {
    // TV brush fillBackground: the stroke closed and filled.
    if (d.kind === "brush" && s.fillBackground === true) {
      out.push({ t: "polygon", pts: drawPts, fill: s.backgroundColor ?? s.color, fillOpacity: levelFillOpacity(s), stroke: "none", inert: true });
    }
    out.push(
      { t: "polyline", pts: drawPts, fill: "none", stroke: "transparent", strokeWidth: Math.max(HIT_TOLERANCE * 2, strokeW) },
      { t: "polyline", pts: drawPts, fill: "none", stroke: s.color, strokeWidth: strokeW, strokeOpacity: isHighlighter ? 0.2 : 1, dash, join: "round", cap: "round" },
    );
    // TV path (PolygonRenderer): leftEnd / rightEnd arrows (factory right = 1)
    // drawn with drawArrow in the same stroke — two strokes 5 · width back and
    // 5 · width aside from the tip; with round caps (solid) the tip moves out by
    // width / 2 along the last segment (`_correctArrowPoints`).
    const endArrow = (from: Pt, to: Pt): SceneItem => {
      const len = Math.hypot(to.x - from.x, to.y - from.y);
      const round = (s.lineStyle ?? "solid") === "solid";
      const tip = round && len >= 1 ? { x: from.x + ((to.x - from.x) * (len + s.width / 2)) / len, y: from.y + ((to.y - from.y) * (len + s.width / 2)) / len } : to;
      return { t: "path", d: rangeArrowPath(from, tip, s.width), fill: "none", stroke: s.color, strokeWidth: s.width, dash, join: "round", cap: "round", inert: true };
    };
    const endKind = d.kind === "path" || d.kind === "brush";
    if (endKind && drawPts.length > 1 && (s.leftEnd ?? 0) === 1) out.push(endArrow(drawPts[1], drawPts[0]));
    if (endKind && drawPts.length > 1 && (s.rightEnd ?? (d.kind === "path" ? 1 : 0)) === 1) {
      out.push(endArrow(drawPts[drawPts.length - 2], drawPts[drawPts.length - 1]));
    }
  }
  if (labels) {
    pts.forEach((pt, i) => {
      out.push({ t: "text", x: pt.x, y: pt.y + labelOffsetY(pts, i), text: labels[i] ?? String(i + 1), size: 11, fill: s.color, anchor: "middle" });
    });
  }
  if (selected) out.push({ t: "anchors", pts: handlePts });
  return out;
}
