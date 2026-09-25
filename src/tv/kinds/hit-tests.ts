/*
 * Per-kind hit-test dispatch. Pure TS — no JSX, no Solid.
 *
 * Each kind has a hit-test fn that takes the kind's projected screen points
 * and the cursor; returns either a handle hit (with index) or a body hit,
 * or null. The overlay's render switch handles the visual side.
 *
 * Geometry primitives (distToSegment, pointInPolygon, bboxCorners,
 * GLYPH_HALF, HIT_TOLERANCE, HANDLE_RADIUS) live in ../_shared.ts.
 */
import {
  HANDLE_RADIUS,
  HIT_TOLERANCE,
  bboxCorners,
  distToSegment,
  pointInPolygon,
  strokeTolerance,
  type HitResult,
  type Pt,
} from "../_shared";
import { glyphHitTest } from "./_glyph";
import { rotatedRectCorners } from "../rotated-rect";
import type { Drawing } from "../types";
import { TREND_FIB_TIME_LEVEL_DEFAULTS } from "../specs";
import { FIB_CIRCLE_LEVEL_DEFAULTS, FIB_LEVEL_DEFAULTS, FIB_TIMEZONE_LEVEL_DEFAULTS, FIB_WEDGE_LEVEL_DEFAULTS, GANN_FAN_LEVEL_DEFAULTS, PARALLEL_CHANNEL_LEVEL_DEFAULTS, PITCHFORK_LEVEL_DEFAULTS, SPEED_ARC_LEVEL_DEFAULTS, SPEED_FAN_LEVEL_DEFAULTS } from "../specs";
import type { Coords } from "../coords";
import { positionLevels } from "./position";
import { gannBox, gannFrame } from "./gann-square";
import { gannFanDir } from "./gann-fan";
import { pitchforkExtendRight, pitchforkGeom } from "./pitchfork";
import { trendFibTimeLevels } from "./fib-time";
import { priceNoteLabel } from "./price-note";
import { rectangleTextLayout } from "./rectangle-text";
import { anchoredVpBox, fixedVpBox, forecastArcSamples, regressionScreenLines, vwapBandLine, vwapScreenSeries } from "./data-series";
import { extendRay, speedFanGeometry } from "./speed-fan";
import { barsPatternGeometry } from "./bars-pattern";
import { arrowMarkTextBox } from "./arrow-mark";
import { tableAnchors, tableEdgeIndex, tableHitCell, tableLayout } from "./table";
import { imageAnchors, imageBox } from "./images";
import { signpostLayout } from "./signpost";
import { calloutLayout, commentLayout, noteLayout, pinLayout, priceLabelLayout, textToolLayout } from "./text-tools";

const HANDLE_R = HANDLE_RADIUS + HIT_TOLERANCE;

function inBox(c: Pt, b: { left: number; top: number; width: number; height: number }): boolean {
  return c.x >= b.left && c.x <= b.left + b.width && c.y >= b.top && c.y <= b.top + b.height;
}

function endpointHit(pts: Pt[], cursor: Pt): HitResult | null {
  for (let i = 0; i < pts.length; i++) {
    if (Math.hypot(pts[i].x - cursor.x, pts[i].y - cursor.y) <= HANDLE_R) {
      return { hit: "handle", handleIndex: i };
    }
  }
  return null;
}

function bboxCornerHit(a: Pt, b: Pt, cursor: Pt): HitResult | null {
  const cs = bboxCorners(a, b);
  for (let i = 0; i < 4; i++) {
    if (Math.hypot(cs[i].x - cursor.x, cs[i].y - cursor.y) <= HANDLE_R) {
      return { hit: "handle", handleIndex: i };
    }
  }
  return null;
}

function horizontalLineHit(pts: Pt[], cursor: Pt, w: number, tol = HIT_TOLERANCE): HitResult | null {
  const a = pts[0];
  // Anchor at 90% of the pane width (TV line-tool-horizontal-line).
  if (Math.hypot(0.9 * w - cursor.x, a.y - cursor.y) <= HANDLE_R) {
    return { hit: "handle", handleIndex: 0 };
  }
  if (Math.abs(cursor.y - a.y) <= tol) return { hit: "body" };
  return null;
}

function verticalLineHit(pts: Pt[], cursor: Pt, h: number, tol = HIT_TOLERANCE): HitResult | null {
  const a = pts[0];
  // Anchor at 90% of the pane height (TV line-tool-vertical-line).
  if (Math.hypot(a.x - cursor.x, 0.9 * h - cursor.y) <= HANDLE_R) {
    return { hit: "handle", handleIndex: 0 };
  }
  if (Math.abs(cursor.x - a.x) <= tol) return { hit: "body" };
  return null;
}

function crossLineHit(pts: Pt[], cursor: Pt, tol = HIT_TOLERANCE): HitResult | null {
  const a = pts[0];
  if (Math.hypot(a.x - cursor.x, a.y - cursor.y) <= HANDLE_R) {
    return { hit: "handle", handleIndex: 0 };
  }
  if (Math.abs(cursor.y - a.y) <= tol || Math.abs(cursor.x - a.x) <= tol) {
    return { hit: "body" };
  }
  return null;
}

function horizontalRayHit(pts: Pt[], cursor: Pt, tol = HIT_TOLERANCE): HitResult | null {
  const a = pts[0];
  if (Math.hypot(a.x - cursor.x, a.y - cursor.y) <= HANDLE_R) {
    return { hit: "handle", handleIndex: 0 };
  }
  // Body only to the right of the anchor (the ray extends rightward).
  if (cursor.x >= a.x - HANDLE_R && Math.abs(cursor.y - a.y) <= tol) {
    return { hit: "body" };
  }
  return null;
}

function fibHit(drawing: Drawing, pts: Pt[], cursor: Pt): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  // Body anywhere within the price band the levels span, limited to the
  // anchors' x-range (TV: levels don't extend unless the extend flags are on).
  const s = drawing.style;
  const left = s.extendLeft ? -Infinity : Math.min(pts[0].x, pts[1].x);
  const right = s.extendRight ? Infinity : Math.max(pts[0].x, pts[1].x);
  const top = Math.min(pts[0].y, pts[1].y);
  const bottom = Math.max(pts[0].y, pts[1].y);
  if (
    cursor.x >= left - HIT_TOLERANCE && cursor.x <= right + HIT_TOLERANCE &&
    cursor.y >= top - HIT_TOLERANCE && cursor.y <= bottom + HIT_TOLERANCE
  ) {
    return { hit: "body" };
  }
  return null;
}

/** Trend-line family: the hit segment follows the RENDERED extension (TV's
 *  `_extendAndHitTestLineSegment`) — a ray is selectable anywhere it paints,
 *  not just between its anchors. Defaults per kind: ray extends right,
 *  extended-line both ways; explicit style flags override. */
function extendableLineHit(d: Drawing, pts: Pt[], cursor: Pt, width: number, height: number): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  const s = d.style;
  const extL = s.extendLeft ?? (d.kind === "extended-line");
  const extR = s.extendRight ?? (d.kind === "ray" || d.kind === "extended-line");
  const [a, b] = pts;
  let A = a;
  let B = b;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len > 1e-6) {
    const big = (width + height) * 2;
    if (extR) B = { x: b.x + (dx / len) * big, y: b.y + (dy / len) * big };
    if (extL) A = { x: a.x - (dx / len) * big, y: a.y - (dy / len) * big };
  }
  if (distToSegment(cursor.x, cursor.y, A, B) <= strokeTolerance(s)) return { hit: "body" };
  return null;
}

function lineHit(pts: Pt[], cursor: Pt, tol = HIT_TOLERANCE): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  if (distToSegment(cursor.x, cursor.y, pts[0], pts[1]) <= tol) {
    return { hit: "body" };
  }
  return null;
}

/** Position tool (TV model): 4 virtual anchors — 0 = entry (free), 1 = close
 *  point (time-only), 2 = stop (price-only), 3 = target (price-only) — plus
 *  the risk/reward box body. Mirrors DrawingsOverlay positionAnchors. */
function positionHit(drawing: Drawing, pts: Pt[], cursor: Pt, coords: Coords | null | undefined): HitResult | null {
  const a = pts[0];
  const b = pts[1];
  const dp0 = drawing.points[0];
  const dp1 = drawing.points[1];
  if (!dp0 || !dp1) return null;
  const entry = dp0.price;
  const { stop, profit } = positionLevels(drawing, coords?.pipSize() ?? 0.01);
  const sign = drawing.kind === "long-position" ? 1 : -1;
  const yTarget = coords?.priceToY(entry + sign * profit) ?? a.y - 40;
  const yStop = coords?.priceToY(entry - sign * stop) ?? a.y + 40;
  if (yTarget == null || yStop == null) return null;
  const midX = (a.x + b.x) / 2;
  const anchors: Pt[] = [a, { x: b.x, y: a.y }, { x: midX, y: yStop }, { x: midX, y: yTarget }];
  const ah = endpointHit(anchors, cursor);
  if (ah) return ah;
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x, b.x);
  const top = Math.min(yTarget, yStop);
  const bottom = Math.max(yTarget, yStop);
  if (
    cursor.x >= left - HIT_TOLERANCE && cursor.x <= right + HIT_TOLERANCE &&
    cursor.y >= top - HIT_TOLERANCE && cursor.y <= bottom + HIT_TOLERANCE
  ) {
    return { hit: "body" };
  }
  return null;
}

/** A segment continued past its ends to beyond the pane (TV extendleft /
 *  extendright: the extended part hits like the line). */
function extendHitSeg(l: Pt, r: Pt, extL: boolean, extR: boolean, big: number): [Pt, Pt] {
  const dx = r.x - l.x, dy = r.y - l.y;
  const len = Math.hypot(dx, dy) || 1;
  return [
    extL ? { x: l.x - (dx / len) * big, y: l.y - (dy / len) * big } : l,
    extR ? { x: r.x + (dx / len) * big, y: r.y + (dy / len) * big } : r,
  ];
}

/** Cursor inside the band a + u·(b − a) + v·n, v in [lo, hi], u in [0, 1]
 *  (or open on an extended side). */
function inBand(cursor: Pt, a: Pt, b: Pt, n: Pt, lo: number, hi: number, extL: boolean, extR: boolean): boolean {
  const ux = b.x - a.x, uy = b.y - a.y;
  const det = ux * n.y - uy * n.x;
  if (Math.abs(det) < 1e-9) return false;
  const px = cursor.x - a.x, py = cursor.y - a.y;
  const u = (px * n.y - py * n.x) / det;
  const v = (ux * py - uy * px) / det;
  return (extL || u >= 0) && (extR || u <= 1) && v >= Math.min(lo, hi) && v <= Math.max(lo, hi);
}


function pitchforkHit(drawing: Drawing, pts: Pt[], cursor: Pt, width: number, height: number): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  const g = pitchforkGeom(drawing.kind, pts);
  if (!g) return null;
  const s = drawing.style;
  const far = (o: Pt) => pitchforkExtendRight(o, g.dir, width);
  // TV extendLines: the median and the level lines also run back.
  const big = (width + height) * 2;
  const dl = Math.hypot(g.dir.x, g.dir.y) || 1;
  const back = (o: Pt): Pt => (s.extendLines ? { x: o.x - (g.dir.x / dl) * big, y: o.y - (g.dir.y / dl) * big } : o);
  const lines: [Pt, Pt][] = [
    [back(g.pivot), far(g.pivot)],
    [pts[1], pts[2]],
  ];
  const levels = (s.levels ?? PITCHFORK_LEVEL_DEFAULTS).filter((l) => l.visible);
  for (const lvl of levels) {
    for (const sign of [1, -1] as const) {
      const o = { x: g.mid.x + g.half.x * lvl.coeff * sign, y: g.mid.y + g.half.y * lvl.coeff * sign };
      lines.push([back(o), far(o)]);
    }
  }
  for (const [a, b] of lines) {
    if (distToSegment(cursor.x, cursor.y, a, b) <= HIT_TOLERANCE) return { hit: "body" };
  }
  // TV ChannelRenderer (hittestOnBackground): the filled bands between the
  // median and the outermost visible level on each side, forward from the
  // p2-p3 segment (also backwards with extend lines).
  if (s.fillBackground !== false && levels.length > 0) {
    const kmax = Math.max(...levels.map((l) => l.coeff));
    const b = { x: g.mid.x + g.dir.x, y: g.mid.y + g.dir.y };
    if (inBand(cursor, g.mid, b, g.half, -kmax, kmax, !!s.extendLines, true)) return { hit: "body" };
  }
  return null;
}

/** Trend-based fib extension: pts 0-1 are the measured move, pt2 the projection
 *  anchor. Hit an endpoint or anywhere within the projected band. */
function fibExtHit(drawing: Drawing, pts: Pt[], cursor: Pt): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  const s = drawing.style;
  const left = s.extendLeft ? -Infinity : Math.min(pts[1].x, pts[2].x);
  const right = s.extendRight ? Infinity : Math.max(pts[1].x, pts[2].x);
  const top = Math.min(pts[0].y, pts[1].y, pts[2].y);
  const bottom = Math.max(pts[0].y, pts[1].y, pts[2].y);
  if (
    cursor.x >= left - HIT_TOLERANCE && cursor.x <= right + HIT_TOLERANCE &&
    cursor.y >= top - HIT_TOLERANCE && cursor.y <= bottom + HIT_TOLERANCE
  ) {
    return { hit: "body" };
  }
  return null;
}

/** Gann fan: every visible level ray is hit-testable (kinds/gann-fan
 *  gannFanDir, as drawn). */
function gannFanHit(drawing: Drawing, pts: Pt[], cursor: Pt, width: number, height: number): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  const [a, b] = pts;
  const big = (width + height) * 2;
  const levels = (drawing.style.levels ?? GANN_FAN_LEVEL_DEFAULTS).filter((l) => l.visible);
  for (const lvl of levels) {
    const v = gannFanDir(a, b, lvl.coeff);
    const len = Math.hypot(v.x, v.y) || 1;
    const e = { x: a.x + (v.x / len) * big, y: a.y + (v.y / len) * big };
    if (distToSegment(cursor.x, cursor.y, a, e) <= HIT_TOLERANCE) return { hit: "body" };
  }
  return null;
}

/** Fib time zone: vertical lines at level-coeff multiples of the p0→p1 x
 *  distance (TV: 11 Fibonacci-sequence levels), plus the anchor connector. */
function fibTimeZoneHit(drawing: Drawing, pts: Pt[], cursor: Pt, tol: number): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  const unit = pts[1].x - pts[0].x;
  const levels = (drawing.style.levels ?? FIB_TIMEZONE_LEVEL_DEFAULTS).filter((l) => l.visible);
  for (const lvl of levels) {
    if (Math.abs(cursor.x - (pts[0].x + unit * lvl.coeff)) <= Math.max(tol, (lvl.width ?? 1) / 2 + 2)) {
      return { hit: "body" };
    }
  }
  if (distToSegment(cursor.x, cursor.y, pts[0], pts[1]) <= tol) return { hit: "body" };
  return null;
}

/** Fib circles: concentric rings centred on pt0, outer radius = |pt1 - pt0|. */
function fibCirclesHit(drawing: Drawing, pts: Pt[], cursor: Pt): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  if (drawing.fmt === 2) {
    // TV model: inside the outermost visible ellipse (centre = p0-p1 midpoint).
    const coeffs = (drawing.style.levels ?? FIB_CIRCLE_LEVEL_DEFAULTS).filter((l) => l.visible).map((l) => l.coeff);
    if (coeffs.length === 0) return null;
    const k = Math.max(...coeffs);
    const hx = (Math.abs(pts[1].x - pts[0].x) / 2) * k + HIT_TOLERANCE;
    const hy = (Math.abs(pts[1].y - pts[0].y) / 2) * k + HIT_TOLERANCE;
    const dx = (cursor.x - (pts[0].x + pts[1].x) / 2) / hx;
    const dy = (cursor.y - (pts[0].y + pts[1].y) / 2) / hy;
    return dx * dx + dy * dy <= 1 ? { hit: "body" } : null;
  }
  const r = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
  const d = Math.hypot(cursor.x - pts[0].x, cursor.y - pts[0].y);
  if (d <= r + HIT_TOLERANCE) return { hit: "body" };
  return null;
}

/** Parallel channel (TV anchors): 0/1 = main-edge ends, 2/3 = offset-edge
 *  ends, 4 = offset-edge middle (height), 5 = main-edge middle (move base).
 *  Body = either edge, the middle line, or the band interior. */
function parallelChannelHit(drawing: Drawing, pts: Pt[], cursor: Pt, tol: number, width: number, height: number): HitResult | null {
  const [a, b, c] = pts;
  const t = (b.x - a.x) === 0 ? 0 : (c.x - a.x) / (b.x - a.x);
  const dy = c.y - (a.y + (b.y - a.y) * t);
  const a2 = { x: a.x, y: a.y + dy };
  const b2 = { x: b.x, y: b.y + dy };
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const anchors: Pt[] = [a, b, a2, b2, { x: mid.x, y: mid.y + dy }, mid];
  const ah = endpointHit(anchors, cursor);
  if (ah) return ah;
  // TV ParallelChannelRenderer: every visible level line (extended with the
  // extend flags) and, with the background on, the band between the first
  // and the last visible level (hittestOnBackground).
  const s = drawing.style;
  const vis = (s.levels ?? PARALLEL_CHANNEL_LEVEL_DEFAULTS).filter((l) => l.visible);
  if (vis.length === 0) return null;
  const big = (width + height) * 2;
  for (const l of vis) {
    const o = dy * l.coeff;
    const [p, q] = extendHitSeg({ x: a.x, y: a.y + o }, { x: b.x, y: b.y + o }, !!s.extendLeft, !!s.extendRight, big);
    if (distToSegment(cursor.x, cursor.y, p, q) <= tol) return { hit: "body" };
  }
  if (s.fillBackground !== false && inBand(cursor, a, b, { x: 0, y: dy }, vis[0].coeff, vis[vis.length - 1].coeff, !!s.extendLeft, !!s.extendRight)) return { hit: "body" };
  return null;
}

/** Disjoint channel (TV mirror model): edge 2 = (p1.x, y(p2)) → (p0.x,
 *  y(p2) + (p1.y − p0.y)). Anchors: 0/1 = edge-1 ends, 2 = edge-2 end at
 *  p1.x (→ p2 price), 3 = edge-2 end at p0.x (→ p0 price via the mirror). */
function disjointChannelHit(drawing: Drawing, pts: Pt[], cursor: Pt, tol: number, width: number, height: number): HitResult | null {
  const [a, b, c] = pts;
  const P = { x: b.x, y: c.y };
  const A = { x: a.x, y: c.y + (b.y - a.y) };
  const anchors: Pt[] = [a, b, P, A];
  const ah = endpointHit(anchors, cursor);
  if (ah) return ah;
  // TV (module 632446): both lines with the extend flags; the background
  // hits only on mobile (hittestOnBackground = isAnyMobile).
  const s = drawing.style;
  const big = (width + height) * 2;
  for (const [l, r] of [[a, b], [A, P]] as const) {
    const [p, q] = extendHitSeg(l, r, !!s.extendLeft, !!s.extendRight, big);
    if (distToSegment(cursor.x, cursor.y, p, q) <= tol) return { hit: "body" };
  }
  return null;
}

/** Flat top/bottom channel: pts 0-1 are the sloped edge, pt2 the price of
 *  the flat edge. Hit either edge (extended) or an endpoint. */
function channelHit(drawing: Drawing, pts: Pt[], cursor: Pt, tol: number, width: number, height: number): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  // TV flat top/bottom: the p0-p1 line and the flat line at p2's price over
  // the same bars, both with the extend flags; no background hit on desktop.
  const [a, b, c] = pts;
  const s = drawing.style;
  const big = (width + height) * 2;
  for (const [l, r] of [[a, b], [{ x: a.x, y: c.y }, { x: b.x, y: c.y }]] as const) {
    const [p, q] = extendHitSeg(l, r, !!s.extendLeft, !!s.extendRight, big);
    if (distToSegment(cursor.x, cursor.y, p, q) <= tol) return { hit: "body" };
  }
  return null;
}

/** Fib channel (TV): level k = segment p0→p1 moved by coeff·(p2 − p0); the
 *  band between the lowest and highest visible level is hit-testable (TV
 *  `hittestOnBackground`), plus each level line. */
function fibChannelHit(drawing: Drawing, pts: Pt[], cursor: Pt, tol: number, width: number, height: number): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  const [a, b, c] = pts;
  if (!c) return distToSegment(cursor.x, cursor.y, a, b) <= tol ? { hit: "body" } : null;
  const s = drawing.style;
  const n = { x: c.x - a.x, y: c.y - a.y };
  const coeffs = (s.levels ?? FIB_LEVEL_DEFAULTS).filter((l) => l.visible).map((l) => l.coeff);
  if (coeffs.length === 0) return null;
  const big = (width + height) * 2;
  for (const k of coeffs) {
    const [p, q] = extendHitSeg({ x: a.x + n.x * k, y: a.y + n.y * k }, { x: b.x + n.x * k, y: b.y + n.y * k }, !!s.extendLeft, !!s.extendRight, big);
    if (distToSegment(cursor.x, cursor.y, p, q) <= tol) return { hit: "body" };
  }
  // TV ParallelChannelRenderer: the band between the lowest and highest
  // visible level when the background is on.
  if (s.fillBackground === false) return null;
  return inBand(cursor, a, b, n, Math.min(...coeffs), Math.max(...coeffs), !!s.extendLeft, !!s.extendRight) ? { hit: "body" } : null;
}

/** Rotated ellipse (TV): p0/p1 = major axis, p2 = half-height point. Cursor is
 *  transformed into the ellipse frame for the containment test. */
function ellipse3Hit(pts: Pt[], cursor: Pt): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  const [a, b, c] = pts;
  if (!c) return null;
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const rx = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y) / 2);
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const nx = -Math.sin(ang);
  const ny = Math.cos(ang);
  const ry = Math.max(1, Math.abs((c.x - cx) * nx + (c.y - cy) * ny));
  // Rotate the cursor into the unrotated frame.
  const dx = cursor.x - cx;
  const dy = cursor.y - cy;
  const lx = dx * Math.cos(-ang) - dy * Math.sin(-ang);
  const ly = dx * Math.sin(-ang) + dy * Math.cos(-ang);
  const q = (lx / (rx + HIT_TOLERANCE)) ** 2 + (ly / (ry + HIT_TOLERANCE)) ** 2;
  if (q <= 1) return { hit: "body" };
  return null;
}

/** Rectangle edge midpoints (TV's 8-anchor rectangle): indices 4-7 continue
 *  the bboxCorners order — 4 = top, 5 = right, 6 = bottom, 7 = left. Each
 *  drags only its edge (see DrawingsOverlay applyDrag). */
export function rectEdgeMidpoints(a: Pt, b: Pt): [Pt, Pt, Pt, Pt] {
  const [tl, tr, br, bl] = bboxCorners(a, b);
  return [
    { x: (tl.x + tr.x) / 2, y: tl.y },
    { x: tr.x, y: (tr.y + br.y) / 2 },
    { x: (bl.x + br.x) / 2, y: br.y },
    { x: tl.x, y: (tl.y + bl.y) / 2 },
  ];
}

function rectangleHit(pts: Pt[], cursor: Pt, withMidpoints = false): HitResult | null {
  const [a, b] = pts;
  const ch = bboxCornerHit(a, b, cursor);
  if (ch) return ch;
  if (withMidpoints) {
    const mids = rectEdgeMidpoints(a, b);
    for (let i = 0; i < 4; i++) {
      if (Math.hypot(mids[i].x - cursor.x, mids[i].y - cursor.y) <= HANDLE_R) {
        return { hit: "handle", handleIndex: 4 + i };
      }
    }
  }
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const bottom = Math.max(a.y, b.y);
  if (
    cursor.x >= left - HIT_TOLERANCE &&
    cursor.x <= right + HIT_TOLERANCE &&
    cursor.y >= top - HIT_TOLERANCE &&
    cursor.y <= bottom + HIT_TOLERANCE
  ) {
    return { hit: "body" };
  }
  return null;
}

/** TV circle: center = p0, radius = screen distance to p1. Anything within
 *  radius + tolerance hits (ring or filled interior — TV treats both as the
 *  movable body; the two stored points are the anchors). */
function circleHit(pts: Pt[], cursor: Pt): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  const [c, e] = pts;
  const r = Math.hypot(e.x - c.x, e.y - c.y);
  if (Math.hypot(cursor.x - c.x, cursor.y - c.y) <= r + HIT_TOLERANCE) return { hit: "body" };
  return null;
}

function priceRangeHit(drawing: Drawing, pts: Pt[], cursor: Pt, width: number): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  // TV: the box between the two prices over the P0-P1 x range (extend flags
  // stretch it to the pane edges).
  const left = drawing.style.extendLeft ? 0 : Math.min(pts[0].x, pts[1].x);
  const right = drawing.style.extendRight ? width : Math.max(pts[0].x, pts[1].x);
  const top = Math.min(pts[0].y, pts[1].y);
  const bottom = Math.max(pts[0].y, pts[1].y);
  if (cursor.x >= left - HIT_TOLERANCE && cursor.x <= right + HIT_TOLERANCE && cursor.y >= top - HIT_TOLERANCE && cursor.y <= bottom + HIT_TOLERANCE) {
    return { hit: "body" };
  }
  return null;
}

function dateRangeHit(pts: Pt[], cursor: Pt): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  // TV: the box between the two times over the P0-P1 price range.
  const left = Math.min(pts[0].x, pts[1].x);
  const right = Math.max(pts[0].x, pts[1].x);
  const top = Math.min(pts[0].y, pts[1].y);
  const bottom = Math.max(pts[0].y, pts[1].y);
  if (cursor.x >= left - HIT_TOLERANCE && cursor.x <= right + HIT_TOLERANCE && cursor.y >= top - HIT_TOLERANCE && cursor.y <= bottom + HIT_TOLERANCE) {
    return { hit: "body" };
  }
  return null;
}

/** Rotated rectangle: pts 0-1 are one edge; pt2 sets the perpendicular width. */
function rotatedRectHit(drawing: Drawing, pts: Pt[], cursor: Pt): HitResult | null {
  const fmt2 = drawing.fmt === 2;
  const corners = rotatedRectCorners(pts, fmt2);
  // fmt 2 (TV): anchors p0, p1 + the 4 corners; a corner drags p2 (index 2+).
  const anchors = fmt2 ? [pts[0], pts[1], ...corners] : pts;
  const h = endpointHit(anchors, cursor);
  if (h) return h;
  if (pointInPolygon(cursor.x, cursor.y, corners)) return { hit: "body" };
  return null;
}

function triangleHit(pts: Pt[], cursor: Pt): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  if (pointInPolygon(cursor.x, cursor.y, pts)) return { hit: "body" };
  return null;
}

/* ---------- fib-fan / cycle / curve family (mirror DrawingsOverlay renderers) ---------- */

function polylineHit(samples: Pt[], cursor: Pt, tol = HIT_TOLERANCE): HitResult | null {
  for (let i = 1; i < samples.length; i++) {
    if (distToSegment(cursor.x, cursor.y, samples[i - 1], samples[i]) <= tol) {
      return { hit: "body" };
    }
  }
  return null;
}

/** Fan rays from p1 through (p2.x, p1.y + dy*ratio), extended to the right edge. */
/** Speed-resistance fan: the coeff-0/1 rays + every visible ladder ray + the
 *  box edges are all hit targets (mirrors renderFibSpeedFan). */
/** Bars pattern (TV): the anchors, then the drawn bars (each 2px bar, x ± 1,
 *  top to bottom, widened by the hit tolerance) or the line in line modes.
 *  Without a snapshot: the two vertical lines and the P0-P1 median. */
function barsPatternHit(drawing: Drawing, pts: Pt[], cursor: Pt, coords: Coords | null, tol = HIT_TOLERANCE): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  const g = barsPatternGeometry(drawing, pts, coords);
  if (!g) {
    const [a, b] = pts;
    if (Math.abs(cursor.x - a.x) <= tol || Math.abs(cursor.x - b.x) <= tol) return { hit: "body" };
    return distToSegment(cursor.x, cursor.y, a, b) <= tol ? { hit: "body" } : null;
  }
  if (g.lineMode) {
    for (let i = 1; i < g.line.length; i++) {
      if (distToSegment(cursor.x, cursor.y, g.line[i - 1], g.line[i]) <= tol) return { hit: "body" };
    }
    return null;
  }
  for (const b of g.bars) {
    if (Math.abs(cursor.x - b.x) <= 1 + tol && cursor.y >= b.top - tol && cursor.y <= b.bottom + tol) return { hit: "body" };
  }
  return null;
}

/** TV arrow mark hit box: 19.5px wide, from the tip 22px along the arrow
 *  (up: below the point, down: above); the anchor first. */
function arrowMarkHit(drawing: Drawing, pts: Pt[], cursor: Pt, dir: "up" | "down"): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  const c = pts[0];
  const top = dir === "up" ? c.y : c.y - 22;
  if (cursor.x >= c.x - 9.75 && cursor.x <= c.x + 9.75 && cursor.y >= top && cursor.y <= top + 22) return { hit: "body" };
  // TV TextRenderer.hitTest: inside the text box.
  const box = arrowMarkTextBox(drawing, c);
  if (box && cursor.x >= box.left && cursor.x <= box.left + box.width && cursor.y >= box.top && cursor.y <= box.top + box.height) return { hit: "body" };
  return null;
}

function speedFanHit(drawing: Drawing, pts: Pt[], cursor: Pt, width: number, coords: Coords | null): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  const [a, b] = pts;
  // TV rays: p0 through every price level (on p1's bar) and every time level
  // (on p1's price), extended.
  const g = speedFanGeometry(drawing, pts, coords, SPEED_FAN_LEVEL_DEFAULTS);
  const size = Math.max(width, Math.abs(b.y - a.y) + Math.max(a.y, b.y));
  const targets: Pt[] = [...g.h.map((l) => ({ x: b.x, y: l.y })), ...g.v.map((l) => ({ x: l.x, y: b.y }))];
  for (const t of targets) {
    const far = extendRay(a, t, width, size);
    if (distToSegment(cursor.x, cursor.y, a, far) <= HIT_TOLERANCE) return { hit: "body" };
  }
  // Box edges.
  const c2 = { x: b.x, y: a.y };
  const c3 = { x: a.x, y: b.y };
  for (const [u, v] of [[a, c2], [c2, b], [b, c3], [c3, a]] as [Pt, Pt][]) {
    if (distToSegment(cursor.x, cursor.y, u, v) <= HIT_TOLERANCE) return { hit: "body" };
  }
  return null;
}

/** Fib wedge: apex p1, edges interpolated by retracement ratio about the
 *  horizontal through p1. */
/** Pitchfan (TV): rays from p0 through the median point + mid ± half·coeff. */
function pitchfanHit(drawing: Drawing, pts: Pt[], cursor: Pt, width: number): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  const [p0, p1, p2] = pts;
  if (!p2) return null;
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const half = { x: (p2.x - p1.x) / 2, y: (p2.y - p1.y) / 2 };
  const big = width * 4;
  const targets: Pt[] = [mid];
  const levels = (drawing.style.levels ?? PITCHFORK_LEVEL_DEFAULTS).filter((l) => l.visible);
  for (const lvl of levels) {
    targets.push({ x: mid.x + half.x * lvl.coeff, y: mid.y + half.y * lvl.coeff });
    targets.push({ x: mid.x - half.x * lvl.coeff, y: mid.y - half.y * lvl.coeff });
  }
  for (const t of targets) {
    const dx = t.x - p0.x, dy = t.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const e = { x: p0.x + (dx / len) * big, y: p0.y + (dy / len) * big };
    if (distToSegment(cursor.x, cursor.y, p0, e) <= HIT_TOLERANCE) return { hit: "body" };
  }
  if (distToSegment(cursor.x, cursor.y, p1, p2) <= HIT_TOLERANCE) return { hit: "body" };
  return null;
}

/** Trend-based fib time: the anchors, the trend lines and every visible
 *  level line (kinds/fib-time.ts). */
function trendFibTimeHit(drawing: Drawing, pts: Pt[], cursor: Pt, tol: number, coords: Coords | null): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  const [a, b, c] = pts;
  if (distToSegment(cursor.x, cursor.y, a, b) <= tol) return { hit: "body" };
  if (c && distToSegment(cursor.x, cursor.y, b, c) <= tol) return { hit: "body" };
  const levels = (drawing.style.levels ?? TREND_FIB_TIME_LEVEL_DEFAULTS).filter((l) => l.visible);
  for (const l of trendFibTimeLevels(drawing, pts, coords, levels)) {
    if (Math.abs(cursor.x - l.x) <= Math.max(tol, (l.width ?? 1) / 2 + 2)) return { hit: "body" };
  }
  return null;
}

/** Gann squares: the anchors, then the box (levels / fans / arcs cover it). */
function gannSquareHit(drawing: Drawing, pts: Pt[], cursor: Pt): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  const f = gannFrame(drawing, pts);
  if (!f) return null;
  const b = gannBox(f);
  return cursor.x >= b.left - HIT_TOLERANCE && cursor.x <= b.right + HIT_TOLERANCE && cursor.y >= b.top - HIT_TOLERANCE && cursor.y <= b.bottom + HIT_TOLERANCE
    ? { hit: "body" }
    : null;
}

/** Sector: the anchors, the edges, the arc and the filled wedge. */
function sectorHit(pts: Pt[], cursor: Pt): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  const [p0, p1, p2raw] = pts;
  if (!p2raw) return null;
  const len1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  if (len1 < 1e-6) return null;
  const a1 = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  const a2 = Math.atan2(p2raw.y - p0.y, p2raw.x - p0.x);
  let sweep = a2 - a1;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  while (sweep < -Math.PI) sweep += 2 * Math.PI;
  const r = Math.hypot(cursor.x - p0.x, cursor.y - p0.y);
  let ang = Math.atan2(cursor.y - p0.y, cursor.x - p0.x) - a1;
  while (ang > Math.PI) ang -= 2 * Math.PI;
  while (ang < -Math.PI) ang += 2 * Math.PI;
  const inSweep = sweep >= 0 ? ang >= -0.05 && ang <= sweep + 0.05 : ang <= 0.05 && ang >= sweep - 0.05;
  return inSweep && r <= len1 + HIT_TOLERANCE ? { hit: "body" } : null;
}

function wedgeHit(drawing: Drawing, pts: Pt[], cursor: Pt): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  const [p0, p1, p2raw] = pts;
  if (!p2raw) return null;
  const len1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  if (len1 < 1e-6) return null;
  const a1 = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  const a2 = Math.atan2(p2raw.y - p0.y, p2raw.x - p0.x);
  const p2 = { x: p0.x + Math.cos(a2) * len1, y: p0.y + Math.sin(a2) * len1 };
  if (distToSegment(cursor.x, cursor.y, p0, p1) <= HIT_TOLERANCE) return { hit: "body" };
  if (distToSegment(cursor.x, cursor.y, p0, p2) <= HIT_TOLERANCE) return { hit: "body" };
  // Level arcs: radius within tolerance of coeff·edge AND angle inside the sweep.
  let sweep = a2 - a1;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  while (sweep < -Math.PI) sweep += 2 * Math.PI;
  const r = Math.hypot(cursor.x - p0.x, cursor.y - p0.y);
  let ang = Math.atan2(cursor.y - p0.y, cursor.x - p0.x) - a1;
  while (ang > Math.PI) ang -= 2 * Math.PI;
  while (ang < -Math.PI) ang += 2 * Math.PI;
  const inSweep = sweep >= 0 ? ang >= -0.05 && ang <= sweep + 0.05 : ang <= 0.05 && ang >= sweep - 0.05;
  if (inSweep) {
    const levels = (drawing.style.levels ?? FIB_WEDGE_LEVEL_DEFAULTS).filter((l) => l.visible);
    for (const lvl of levels) {
      if (Math.abs(r - len1 * lvl.coeff) <= HIT_TOLERANCE) return { hit: "body" };
    }
  }
  return null;
}

/** Fib speed-resistance arcs: concentric forward half-arcs at unit×ratio radii. */
function arcsHit(drawing: Drawing, pts: Pt[], cursor: Pt): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  const [c, edge] = pts;
  const unit = Math.hypot(edge.x - c.x, edge.y - c.y);
  if (unit < 1e-6) return null;
  // TV geometry: half circles cut by the horizontal through p0, opening
  // toward p1's vertical side — the cursor must be on that side.
  const dir = edge.y >= c.y ? 1 : -1;
  if ((cursor.y - c.y) * dir < -HIT_TOLERANCE) return null;
  const dist = Math.hypot(cursor.x - c.x, cursor.y - c.y);
  const levels = (drawing.style.levels ?? SPEED_ARC_LEVEL_DEFAULTS).filter((l) => l.visible);
  for (const lvl of levels) {
    if (Math.abs(dist - unit * lvl.coeff) <= HIT_TOLERANCE) return { hit: "body" };
  }
  return null;
}

/** TV fib-spiral radii (line-tool-fib-spiral): one Fibonacci number per
 *  quarter turn, interpolated with a `frac^1.15` easing between steps. */
const FIB_SPIRAL_RADII = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];

/** TV fib-spiral samples: the spiral starts AT p0 (radius 0), winds clockwise
 *  from the p0→p1 direction, and passes through p1 after exactly one full turn
 *  (radius fib(4)=5 scaled by |p0p1|/5); 2.5 turns total. Shared by the
 *  overlay renderer and the hit-test so both trace the same curve. */
export function spiralSamples(p1: Pt, p2: Pt, ccw = false): Pt[] {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const r0 = Math.hypot(dx, dy);
  if (r0 < 1e-6) return [];
  const baseAngle = Math.atan2(dy, dx);
  const out: Pt[] = [];
  const last = 50 * (FIB_SPIRAL_RADII.length - 1);
  for (let e = 0; e <= last; e++) {
    const t = e / 50; // quarter-turns travelled
    const lo = Math.floor(t);
    const hi = Math.ceil(t);
    if (hi >= FIB_SPIRAL_RADII.length) break;
    const frac = Math.pow(t - lo, 1.15);
    const r = (FIB_SPIRAL_RADII[lo] + (FIB_SPIRAL_RADII[hi] - FIB_SPIRAL_RADII[lo]) * frac) * (r0 / 5);
    // TV counterclockwise: the turn runs the other way.
    const a = baseAngle + ((ccw ? -1 : 1) * e * Math.PI) / 100;
    out.push({ x: p1.x + Math.cos(a) * r, y: p1.y + Math.sin(a) * r });
  }
  return out;
}

/** TV sine-line samples: p0→p1 span HALF a period (p0 = trough, p1 = the
 *  opposite extreme), amplitude = (p1.y − p0.y) / 2, and the wave repeats
 *  across the WHOLE pane. Shared by the overlay renderer and the hit-test. */
export function sineSamples(p1: Pt, p2: Pt, paneW: number): Pt[] {
  const half = Math.abs(p2.x - p1.x);
  if (half < 1e-3) return [];
  const height = p2.y - p1.y; // signed; 0 → flat line (TV)
  const step = Math.max(1, half / 30);
  const out: Pt[] = [];
  for (let x = 0; x <= paneW + step; x += step) {
    out.push({ x, y: p1.y + height / 2 - (Math.cos(((x - p1.x) * Math.PI) / half) * height) / 2 });
  }
  return out;
}

/** Quadratic Bézier samples; extend flags continue the parabola parametrically
 *  past t = 0 / 1 (TV extends the curve itself, not a tangent ray). */
export function bezierSamples(pts: Pt[], extendLeft = false, extendRight = false): Pt[] {
  const [p0, p1, p2] = pts;
  const t0 = extendLeft ? -4 : 0;
  const t1 = extendRight ? 5 : 1;
  const n = Math.ceil(32 * (t1 - t0));
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    const u = 1 - t;
    out.push({ x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y });
  }
  return out;
}

/** TV arc geometry (line-tool-arc chunk): the arc is the 60° cap of a circle
 *  of radius = chord length, drawn in the chord's rotated frame and scaled
 *  vertically so the cap height equals the bulge point's perpendicular
 *  distance from the chord. Returns screen samples start → end, or null when
 *  the chord or the bulge is degenerate (render the plain chord then). */
export function arcSamples(a: Pt, b: Pt, c: Pt): Pt[] | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const u = Math.hypot(dx, dy);
  if (u < 1e-3) return null;
  const cos = dx / u;
  const sin = dy / u;
  // Signed perpendicular offset of the bulge point in the chord frame.
  const off = -sin * (c.x - a.x) + cos * (c.y - a.y);
  const l = Math.abs(off);
  if (l < 1) return null;
  const sign = off < 0 ? -1 : 1;
  const cap = 1 - Math.sqrt(3) / 2; // unscaled cap height, in chord lengths
  const scale = l / (u * cap);
  const out: Pt[] = [];
  for (let i = 0; i <= 48; i++) {
    // t sweeps 2π/3 → π/3 so samples run chord-start → chord-end.
    const t = (2 * Math.PI) / 3 - (i / 48) * (Math.PI / 3);
    const px = u / 2 + u * Math.cos(t);
    const py = sign * scale * u * (Math.sin(t) - Math.sqrt(3) / 2);
    out.push({ x: a.x + cos * px - sin * py, y: a.y + sin * px + cos * py });
  }
  return out;
}

/** Cubic Bézier samples; extend flags continue the cubic parametrically past
 *  t = 0 / 1 (see bezierSamples). */
export function cubicSamples(pts: Pt[], extendLeft = false, extendRight = false): Pt[] {
  const [p0, p1, p2, p3] = pts;
  const t0 = extendLeft ? -3 : 0;
  const t1 = extendRight ? 4 : 1;
  const n = Math.ceil(32 * (t1 - t0));
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    const u = 1 - t;
    out.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return out;
}

/** Pattern/Elliott family — the filled kinds also register a body hit anywhere
 *  inside the closed polygon. xabcd/cypher fill the two TRIANGLES (X-A-B and
 *  B-C-D, TV Pattern5pointsPaneView), not the closed hull — hit-tested apart. */
const FILLED_PATTERN_KINDS = new Set<string>([
  "triangle-pattern",
]);

function labeledPolylineHit(drawing: Drawing, pts: Pt[], cursor: Pt): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  const tol = strokeTolerance(drawing.style);
  for (let i = 1; i < pts.length; i++) {
    if (distToSegment(cursor.x, cursor.y, pts[i - 1], pts[i]) <= tol) return { hit: "body" };
  }
  if (drawing.kind === "xabcd-pattern" || drawing.kind === "cypher-pattern") {
    if (pts.length >= 3 && pointInPolygon(cursor.x, cursor.y, [pts[0], pts[1], pts[2]])) return { hit: "body" };
    if (pts.length >= 5 && pointInPolygon(cursor.x, cursor.y, [pts[2], pts[3], pts[4]])) return { hit: "body" };
    return null;
  }
  if (FILLED_PATTERN_KINDS.has(drawing.kind) && pts.length >= 3 && pointInPolygon(cursor.x, cursor.y, pts)) {
    return { hit: "body" };
  }
  // TV PolygonRenderer.hitTest: a closed + filled polyline also hits on its
  // closing side and inside.
  if (drawing.kind === "polyline" && drawing.closed === true && drawing.style.fillBackground !== false && pts.length >= 2) {
    if (distToSegment(cursor.x, cursor.y, pts[pts.length - 1], pts[0]) <= tol) return { hit: "body" };
    if (pts.length >= 3 && pointInPolygon(cursor.x, cursor.y, pts)) return { hit: "body" };
  }
  return null;
}

/** Freehand stroke (brush/highlighter): the sampled path has many vertices, but
 *  only its two endpoints are draggable handles — the rest is body (the whole
 *  stroke moves together). Mirrors how the overlay renders freehand handles. */
function freehandHit(pts: Pt[], cursor: Pt, tol = HIT_TOLERANCE): HitResult | null {
  if (pts.length === 0) return null;
  const last = pts.length - 1;
  if (Math.hypot(pts[0].x - cursor.x, pts[0].y - cursor.y) <= HANDLE_R) return { hit: "handle", handleIndex: 0 };
  if (Math.hypot(pts[last].x - cursor.x, pts[last].y - cursor.y) <= HANDLE_R) return { hit: "handle", handleIndex: last };
  return polylineHit(pts, cursor, tol);
}

function sampledHit(samples: Pt[], pts: Pt[], cursor: Pt, tol = HIT_TOLERANCE): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  return polylineHit(samples, cursor, tol);
}

/** Cyclic lines (TV): vertical lines from p0 stepping by the SIGNED p0→p1
 *  interval — one direction only, to the pane edge — plus the dashed anchor
 *  connector. Any repeat line or the connector is the body. */
function cyclicLinesHit(pts: Pt[], cursor: Pt, paneW: number, tol: number): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  const [p1, p2] = pts;
  const unit = p2.x - p1.x;
  if (Math.abs(unit) < 1e-3) return null;
  for (let x = p1.x; unit > 0 ? x <= paneW + tol : x >= -tol; x += unit) {
    if (Math.abs(cursor.x - x) <= tol) return { hit: "body" };
  }
  if (distToSegment(cursor.x, cursor.y, p1, p2) <= tol) return { hit: "body" };
  return null;
}

/** Time cycles (TV): contiguous semicircles of diameter = the anchor Δx,
 *  bulging UP from the baseline at p0.y, repeated across the whole pane. */
function timeCyclesHit(pts: Pt[], cursor: Pt, paneW: number, tol: number): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  const [p1, p2] = pts;
  const unit = Math.abs(p2.x - p1.x);
  if (unit < 1e-3) return null;
  const baseY = p1.y;
  if (cursor.y - baseY > tol) return null; // arcs live above the baseline
  const r = unit / 2;
  const startX = Math.min(p1.x, p2.x);
  const k0 = Math.floor((-startX) / unit) - 1;
  const k1 = Math.ceil((paneW - startX) / unit) + 1;
  for (let k = k0; k <= k1; k++) {
    const cx = startX + k * unit + r;
    const dist = Math.hypot(cursor.x - cx, cursor.y - baseY);
    if (Math.abs(dist - r) <= tol) return { hit: "body" };
  }
  return null;
}

/* ---------- text annotations (the boxes as drawn: kinds/text-tools layouts) ---------- */

/** TV price note: the line, then the price label box at P1
 *  (kinds/price-note.ts). */
function priceNoteHit(d: Drawing, pts: Pt[], cursor: Pt, coords: Coords | null | undefined): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  if (pts[1] && distToSegment(cursor.x, cursor.y, pts[0], pts[1]) <= HIT_TOLERANCE) return { hit: "body" };
  const pip = coords?.pipSize() ?? 0.01;
  const box = priceNoteLabel(d, pts, Math.max(0, Math.min(8, Math.round(-Math.log10(pip)))))?.box;
  if (box && cursor.x >= box.left && cursor.x <= box.left + box.width && cursor.y >= box.top && cursor.y <= box.top + box.height) return { hit: "body" };
  return null;
}


/** Regression trend: hit the base line or either deviation band, extended
 *  right when the drawing extends (recomputed from the bars via the shared
 *  helper so the hit region matches the rendered shape exactly). Falls back to
 *  the stored segment when there's no data. */
function regressionHit(d: Drawing, pts: Pt[], cursor: Pt, width: number, coords: Coords | null): HitResult | null {
  const lines = regressionScreenLines(d, coords, width);
  // Anchors sit on the base line (TV _updateAnchorsPrice).
  const h = endpointHit(lines ? lines.anchors : pts, cursor);
  if (h) return h;
  if (!lines) return lineHit(pts, cursor);
  const segs: ([Pt, Pt] | null)[] = [lines.center, lines.upper, lines.lower];
  for (const seg of segs) {
    if (seg && distToSegment(cursor.x, cursor.y, seg[0], seg[1]) <= HIT_TOLERANCE) {
      return { hit: "body" };
    }
  }
  return null;
}

/** Anchored VWAP: handle at the anchor + the actual computed curve and any
 *  visible ±σ band (recomputed via the shared helper). Falls back to a
 *  near-anchor ray before bars load. */
function vwapHit(d: Drawing, pts: Pt[], cursor: Pt, coords: Coords | null): HitResult | null {
  if (Math.hypot(pts[0].x - cursor.x, pts[0].y - cursor.y) <= HANDLE_R) {
    return { hit: "handle", handleIndex: 0 };
  }
  const series = vwapScreenSeries(d, coords);
  if (series.line.length < 2) return horizontalRayHit(pts, cursor);
  const center = polylineHit(series.line, cursor);
  if (center) return center;
  for (const band of series.bands) {
    if (band.upper.length >= 2 && vwapBandLine(d.style, band.index, "upper").visible && polylineHit(band.upper, cursor)) return { hit: "body" };
    if (band.lower.length >= 2 && vwapBandLine(d.style, band.index, "lower").visible && polylineHit(band.lower, cursor)) return { hit: "body" };
  }
  return null;
}

/** Position forecast: endpoint handles + the quarter-ellipse vector (TV hit
 *  tests the ellipse; the source/target balloons stay grabbable through their
 *  anchor handles). */
function forecastHit(pts: Pt[], cursor: Pt, tol = HIT_TOLERANCE): HitResult | null {
  const h = endpointHit(pts, cursor);
  if (h) return h;
  return polylineHit(forecastArcSamples(pts[0], pts[1]), cursor, tol);
}

/** Flag marker: anchor handle at pts[0]; body covers the pole + the banner that
 *  flies up-and-right of it (matches renderFlagMark's box). */
function flagMarkHit(pts: Pt[], cursor: Pt): HitResult | null {
  const c = pts[0];
  if (Math.hypot(c.x - cursor.x, c.y - cursor.y) <= HANDLE_R) return { hit: "handle", handleIndex: 0 };
  const POLE_H = 22, FLAG_W = 17;
  if (
    cursor.x >= c.x - HIT_TOLERANCE && cursor.x <= c.x + FLAG_W + HIT_TOLERANCE &&
    cursor.y >= c.y - POLE_H - HIT_TOLERANCE && cursor.y <= c.y + HIT_TOLERANCE
  ) {
    return { hit: "body" };
  }
  return null;
}

/** Ghost feed: per-vertex anchors + a per-leg segment test widened to the
 *  candle band (the synthetic candles ride each drift leg within roughly ± one
 *  frozen amplitude). Legacy feeds without frozen params render as a box and
 *  keep the bbox hit model. */
function ghostFeedHit(drawing: Drawing, pts: Pt[], cursor: Pt, coords: Coords | null): HitResult | null {
  if (!drawing.ghost) return rectangleHit(pts, cursor);
  const h = endpointHit(pts, cursor);
  if (h) return h;
  let band = HIT_TOLERANCE;
  if (coords) {
    const y0 = coords.priceToY(drawing.points[0].price);
    const y1 = coords.priceToY(drawing.points[0].price + drawing.ghost.amplitude);
    if (y0 != null && y1 != null) band = Math.max(band, Math.abs(y1 - y0));
  }
  for (let i = 1; i < pts.length; i++) {
    if (distToSegment(cursor.x, cursor.y, pts[i - 1], pts[i]) <= band) return { hit: "body" };
  }
  return null;
}

/** Dispatch entry point — projected screen points + the pane size (width/
 *  height are needed by full-extent kinds like horizontal-line). */
export function hitTestKind(
  drawing: Drawing,
  pts: Pt[],
  cursor: Pt,
  width: number,
  height: number,
  coords: Coords | null,
  /** The drawing is selected (table: its row / column edges resize). */
  selected = false,
): HitResult | null {
  // Stroked-line kinds get a hit slop that scales with the drawing's width.
  const tol = strokeTolerance(drawing.style);
  switch (drawing.kind) {
    case "horizontal-line":
      return horizontalLineHit(pts, cursor, width, tol);
    case "horizontal-ray":
      return horizontalRayHit(pts, cursor, tol);
    case "vertical-line":
      return verticalLineHit(pts, cursor, height, tol);
    case "cross-line":
      return crossLineHit(pts, cursor, tol);
    case "arrow-mark-up":
    case "arrow-mark-down":
      return arrowMarkHit(drawing, pts, cursor, drawing.kind === "arrow-mark-up" ? "up" : "down");
    case "font-icon":
      return glyphHitTest(pts, cursor);
    case "table": {
      // TV: corner anchors, then (selected) the row / column edges, then a
      // cell (body, with its index for the in-place editor).
      const l = tableLayout(drawing, pts[0]);
      const a = endpointHit(tableAnchors(l), cursor);
      if (a) return a;
      const r = tableHitCell(l, cursor, selected);
      if (!r) return null;
      return "edge" in r ? { hit: "handle", handleIndex: tableEdgeIndex(r.edge) } : { hit: "body", cell: r.cell };
    }
    case "image": {
      // TV: nothing is drawn (or hit) until the image is loaded.
      const b = imageBox(drawing, pts[0]);
      if (!b) return null;
      const a = endpointHit(imageAnchors(b), cursor);
      if (a) return a;
      return cursor.x >= b.left && cursor.x <= b.right && cursor.y >= b.top && cursor.y <= b.bottom ? { hit: "body" } : null;
    }
    case "price-label": {
      const h = endpointHit(pts, cursor);
      if (h) return h;
      const b = priceLabelLayout(drawing.points[0].price.toFixed(Math.max(0, Math.min(8, Math.round(-Math.log10(coords?.pipSize() ?? 0.01))))), pts[0], drawing.style.fontSize ?? 14);
      return inBox(cursor, { left: b.x, top: b.y, width: b.w, height: b.h }) ? { hit: "body" } : null;
    }
    case "flag-mark":
      return flagMarkHit(pts, cursor);
    case "trend-line":
    case "ray":
    case "extended-line":
    case "info-line":
    case "arrow":
    case "trend-angle":
      return extendableLineHit(drawing, pts, cursor, width, height);
    case "arrow-marker":
      return lineHit(pts, cursor, tol);
    case "position-forecast":
      return forecastHit(pts, cursor, tol);
    case "long-position":
    case "short-position":
      return positionHit(drawing, pts, cursor, coords);
    case "bar-pattern":
      return barsPatternHit(drawing, pts, cursor, coords, tol);
    case "ghost-feed":
      return ghostFeedHit(drawing, pts, cursor, coords);
    case "gann-box":
      return rectangleHit(pts, cursor);
    case "gann-fan":
      return gannFanHit(drawing, pts, cursor, width, height);
    case "fib-time-zone":
      return fibTimeZoneHit(drawing, pts, cursor, tol);
    case "fib-circles":
      return fibCirclesHit(drawing, pts, cursor);
    case "fib-speed-resistance-fan":
      return speedFanHit(drawing, pts, cursor, width, coords);
    case "pitchfan":
      return pitchfanHit(drawing, pts, cursor, width);
    case "fib-wedge":
      return wedgeHit(drawing, pts, cursor);
    case "trend-based-fib-time":
      return trendFibTimeHit(drawing, pts, cursor, tol, coords);
    case "gann-square-fixed":
    case "gann-square":
      return gannSquareHit(drawing, pts, cursor);
    case "sector":
      return sectorHit(pts, cursor);
    case "fib-speed-resistance-arcs":
      return arcsHit(drawing, pts, cursor);
    case "fib-spiral":
      return sampledHit(spiralSamples(pts[0], pts[1], !!drawing.style.counterclockwise), pts, cursor, tol);
    case "sine-line":
      return sampledHit(sineSamples(pts[0], pts[1], width), pts, cursor, tol);
    case "time-cycles":
      return timeCyclesHit(pts, cursor, width, tol);
    case "cyclic-lines":
      return cyclicLinesHit(pts, cursor, width, tol);
    case "curve":
      return sampledHit(
        bezierSamples(pts, !!drawing.style.extendLeft, !!drawing.style.extendRight),
        pts,
        cursor,
        tol,
      );
    case "arc":
      return sampledHit(
        (pts.length === 3 ? arcSamples(pts[0], pts[1], pts[2]) : null) ?? [pts[0], pts[1]],
        pts,
        cursor,
        tol,
      );
    case "double-curve":
      return sampledHit(
        cubicSamples(pts, !!drawing.style.extendLeft, !!drawing.style.extendRight),
        pts,
        cursor,
        tol,
      );
    case "text": {
      // TV text: the box; with word wrap (selected) the right-middle anchor
      // (index 1) sets the wrap width.
      const l = textToolLayout(drawing, pts[0]);
      if (selected && drawing.style.wordWrap) {
        const h = endpointHit([pts[0], { x: l.box.left + l.box.width, y: l.box.top + l.box.height / 2 }], cursor);
        if (h && h.hit === "handle" && h.handleIndex === 1) return h;
      }
      return inBox(cursor, l.box) ? { hit: "body" } : null;
    }
    case "comment": {
      const h = endpointHit(pts, cursor);
      if (h) return h;
      return inBox(cursor, commentLayout(drawing, pts[0]).l.box) ? { hit: "body" } : null;
    }
    case "pin": {
      // TV pin: the marker; the tooltip only while shown (hover / selection).
      const t = pinLayout(drawing, pts[0], width);
      const m = t.marker;
      if (cursor.x >= m.left && cursor.x <= m.right && cursor.y >= m.top && cursor.y <= m.bottom) return { hit: "body" };
      if (selected && inBox(cursor, { left: t.left, top: t.top, width: t.width, height: t.height })) return { hit: "body" };
      return null;
    }
    case "signpost": {
      // TV: the anchor (label point), the pole (3px), the plate, the label.
      if (!coords) return null;
      const g = signpostLayout(drawing, pts[0], coords, height);
      if (Math.hypot(g.anchor.x - cursor.x, g.anchor.y - cursor.y) <= HANDLE_R) return { hit: "handle", handleIndex: 0 };
      if (distToSegment(cursor.x, cursor.y, { x: g.x, y: g.poleStart }, { x: g.x, y: g.poleEnd }) < 3) return { hit: "body" };
      if (drawing.style.showImage && Math.hypot(cursor.x - g.x, cursor.y - g.plateY) <= 38) return { hit: "body" };
      return inBox(cursor, g.l.box) ? { hit: "body" } : null;
    }
    case "note": {
      // TV text note: the leader line or the label box around P1.
      const h = endpointHit(pts, cursor);
      if (h) return h;
      if (pts[1] && distToSegment(cursor.x, cursor.y, pts[0], pts[1]) <= HIT_TOLERANCE) return { hit: "body" };
      // The box as drawn (noteLayout); TV TextRenderer.hitTest: inside it.
      if (pts[1] && inBox(cursor, noteLayout(drawing, drawing.style, pts[0], pts[1]).box)) return { hit: "body" };
      return null;
    }
    case "price-note":
      return priceNoteHit(drawing, pts, cursor, coords);
    case "callout": {
      // TV callout: p0 (3px), the wrap anchor (index 1, while wrapping), the
      // box.
      const c = calloutLayout(drawing, pts[1]);
      if (Math.hypot(pts[0].x - cursor.x, pts[0].y - cursor.y) <= HANDLE_R) return { hit: "handle", handleIndex: 0 };
      if (selected && c.wrap != null && Math.hypot(pts[1].x + c.wrap / 2 + 10 - cursor.x, pts[1].y - cursor.y) <= HANDLE_R) return { hit: "handle", handleIndex: 1 };
      return inBox(cursor, { left: c.x, top: c.y, width: c.w, height: c.h }) ? { hit: "body" } : null;
    }
    case "regression-trend":
      return regressionHit(drawing, pts, cursor, width, coords);
    case "fixed-range-volume-profile": {
      const h = endpointHit(pts, cursor);
      if (h) return h;
      const box = fixedVpBox(drawing, pts, coords);
      if (!box) return null;
      return cursor.x >= box.left && cursor.x <= box.right && cursor.y >= box.top && cursor.y <= box.bottom ? { hit: "body" } : null;
    }
    case "anchored-volume-profile": {
      const h = endpointHit([pts[0]], cursor);
      if (h) return h;
      const box = anchoredVpBox(drawing, pts, coords);
      if (!box) return null;
      return cursor.x >= box.left && cursor.x <= box.right && cursor.y >= box.top && cursor.y <= box.bottom ? { hit: "body" } : null;
    }
    case "anchored-vwap":
      return vwapHit(drawing, pts, cursor, coords);
    case "abcd-pattern":
    case "xabcd-pattern":
    case "cypher-pattern":
    case "head-and-shoulders":
    case "triangle-pattern":
    case "three-drives-pattern":
    case "elliott-impulse":
    case "elliott-correction":
    case "elliott-triangle":
    case "elliott-double-combo":
    case "elliott-triple-combo":
    case "polyline":
    case "path":
      return labeledPolylineHit(drawing, pts, cursor);
    case "brush":
    case "highlighter":
      return freehandHit(pts, cursor, tol);
    case "parallel-channel":
      return parallelChannelHit(drawing, pts, cursor, tol, width, height);
    case "disjoint-channel":
      return disjointChannelHit(drawing, pts, cursor, tol, width, height);
    case "flat-top-bottom":
      return channelHit(drawing, pts, cursor, tol, width, height);
    case "pitchfork":
    case "schiff-pitchfork":
    case "modified-schiff-pitchfork":
    case "inside-pitchfork":
      return pitchforkHit(drawing, pts, cursor, width, height);
    case "fib-channel":
      return fibChannelHit(drawing, pts, cursor, tol, width, height);
    case "rotated-rectangle":
      return rotatedRectHit(drawing, pts, cursor);
    case "trend-based-fib-extension":
      return fibExtHit(drawing, pts, cursor);
    case "fib-retracement":
      return fibHit(drawing, pts, cursor);
    case "rectangle": {
      // TV rectangles carry 8 anchors: 4 corners + 4 edge midpoints; the
      // text box hits too (TV TextRenderer), also outside the box.
      const pw = coords?.timeAxis().width || width;
      const r = rectangleHit(pts, cursor, true);
      if (r) return r;
      // TV extend: the box runs to the pane edge on the extended side.
      if (drawing.style.extendLeft || drawing.style.extendRight) {
        const top = Math.min(pts[0].y, pts[1].y);
        const bottom = Math.max(pts[0].y, pts[1].y);
        const l = drawing.style.extendLeft ? 0 : Math.min(pts[0].x, pts[1].x);
        const rr = drawing.style.extendRight ? pw : Math.max(pts[0].x, pts[1].x);
        if (cursor.x >= l && cursor.x <= rr && cursor.y >= top - HIT_TOLERANCE && cursor.y <= bottom + HIT_TOLERANCE) return { hit: "body" };
      }
      const box = rectangleTextLayout(drawing, pts, pw)?.box;
      return box && cursor.x >= box.left && cursor.x <= box.left + box.width && cursor.y >= box.top && cursor.y <= box.top + box.height ? { hit: "body" } : null;
    }
    case "circle":
      return circleHit(pts, cursor);
    case "ellipse":
      return ellipse3Hit(pts, cursor);
    case "price-range":
      return priceRangeHit(drawing, pts, cursor, width);
    case "date-range":
      return dateRangeHit(pts, cursor);
    case "date-and-price-range":
      // TV: 2 anchors (P0, P1) + the box.
      return dateRangeHit(pts, cursor);
    case "triangle":
      return triangleHit(pts, cursor);
  }
}
