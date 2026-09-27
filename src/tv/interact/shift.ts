/*
 * Shift gestures of the drawing tools, ported from TradingView Desktop 3.4.1
 * (live bundles read 27/09/2026):
 *   - LineDataSource (module 688837): `snapPoint45Degree`, `_preparePoint`
 *     (placement: the new point snaps against the previous one), `setPoint`
 *     (anchor drag: point i against point i-1, point 0 against point 1) and the
 *     Shift body move `_alignPointHorizontallyOrVertically` (H/V lock).
 *   - per tool overrides: line-tool-rectangle (square snap, middle anchors),
 *     line-tool-ellipse (circle), line-tool-parallel-channel, line-tool-flat-
 *     bottom / line-tool-disjoint-channel (2nd point only), line-tool-gann-
 *     square ("Gann box": fixed increments), line-tool-gann-complex ("Gann
 *     square": keep the price-per-bar ratio), line-tool-rotated-rectangle.
 * Tools without `snapTo45DegreesAvailable` and without an override (pitchfork
 * family, triangle, fib extension, bar pattern, volume profile...) have no
 * Shift rule in TV.
 */
import type { Time } from "lightweight-charts";
import { bboxCorners, type Pt } from "../_shared";
import type { Coords } from "../coords";
import type { DataPoint, Drawing, DrawingKind } from "../types";
import type { DragState } from "./drag";
import { projectPoint, replaceDrawingPoints, unproject } from "./project";

/** Kinds whose TV class returns `snapTo45DegreesAvailable() === true` with the
 *  base LineDataSource rule (placement + anchor drag). The trend-line chunk
 *  covers trend line, ray, extended line, info line and arrow. */
export const SNAP_45_KINDS = new Set<DrawingKind>([
  "trend-line", "ray", "extended-line", "info-line", "arrow", "trend-angle",
  "arrow-marker", "circle", "fib-circles", "fib-speed-resistance-fan",
  "price-note", "note", "rotated-rectangle",
]);

/** Kinds where only the SECOND placed point snaps (TV overrides
 *  `addPoint` / `setLastPoint`). */
const SECOND_POINT_ONLY = new Set<DrawingKind>(["parallel-channel", "flat-top-bottom", "disjoint-channel"]);

type Bar = { i: number; time: Time; x: number };

function barAtIndex(c: Coords, i: number): Bar | null {
  const time = c.barIndexToTime(i);
  const x = time == null ? null : c.timeToX(time);
  return time == null || x == null ? null : { i, time, x };
}

/** TV `Math.round(timeScale.coordinateToIndex(x))`. */
function barAtX(c: Coords, x: number): Bar | null {
  const t = c.xToTime(x);
  const i = t == null ? null : c.timeToBarIndex(t);
  return i == null ? null : barAtIndex(c, i);
}

/** TV LineDataSource.snapPoint45Degree: the direction from `ref` to `p` (screen
 *  px) rounds to one of 8 (45° steps). Horizontal keeps the bar and takes the
 *  reference price; vertical keeps the price and takes the reference bar; a
 *  diagonal takes the leg hypot/√2, rounds it to a whole bar and derives the
 *  price from the real pixel width of that bar distance. */
export function snapPoint45(c: Coords, p: DataPoint, ref: DataPoint): DataPoint {
  const r = c.timeToX(ref.time);
  const px = c.timeToX(p.time);
  const u = c.priceToY(ref.price);
  const py = c.priceToY(p.price);
  if (r == null || px == null || u == null || py == null) return p;
  const o = px - r;
  const cy = py - u;
  const dir = Math.round((Math.atan2(o, cy) / Math.PI) * 4);
  if (Math.abs(dir) === 2) return { time: p.time, price: ref.price };
  if (dir === 0 || Math.abs(dir) === 4) return { time: ref.time, price: p.price };
  const hyp = Math.hypot(o, cy);
  const sx = o < 0 ? -1 : 1;
  const sy = cy < 0 ? -1 : 1;
  let l = Math.max(Math.abs(cy), Math.abs(o));
  l /= (l * Math.SQRT2) / hyp;
  const b = barAtX(c, r + l * sx);
  if (!b) return p;
  const price = c.yToPrice(u + Math.abs(b.x - r) * sy);
  return price == null ? p : { time: b.time, price };
}

/** TV Rectangle.snapPoint45Degree override: always a square around `ref` —
 *  side = max(|dx|, |dy|) rounded to a whole bar, height = that bar width. */
export function snapPointSquare(c: Coords, p: DataPoint, ref: DataPoint): DataPoint {
  const a = projectPoint(c, p);
  const d = projectPoint(c, ref);
  if (!a || !d) return p;
  const dx = a.x - d.x;
  const dy = a.y - d.y;
  const side = Math.max(Math.abs(dx), Math.abs(dy));
  const b = barAtX(c, d.x + side * (dx < 0 ? -1 : 1));
  if (!b) return p;
  const price = c.yToPrice(d.y + Math.abs(b.x - d.x) * (dy < 0 ? -1 : 1));
  return price == null ? p : { time: b.time, price };
}

// ── Gann box fixed increments (line-tool-gann-square `xe` / `we`) ────────────
const XE = [4.5, 9, 11.25, 18, 22.5, 36, 45];
const WE: number[] = (() => {
  const e: number[] = [];
  const t = XE.length - 1;
  let i = 1;
  let r = 0;
  let n = 0;
  while (n < 1e10) {
    n = XE[r] * i;
    e.push(Math.round(n));
    e.push(Math.ceil(-n));
    if (r === t - 1) i *= 10;
    r = (r + 1) % t;
  }
  return e.sort((a, b) => a - b);
})();

/** TV `_alignPointsFixedIncrement`: the bar distance to `ref` moves to the next
 *  value of the Gann bar table (4.5, 9, 11.25, 18, 22.5, 36 × 10^k, rounded),
 *  the price distance to the smallest of 4.5 / 9 / 11.25 / 18 / 22.5 / 36 / 45
 *  × 10^k that is >= it (raw price units). */
export function gannFixedIncrement(c: Coords, p: DataPoint, ref: DataPoint): DataPoint {
  let time = p.time;
  const ip = c.timeToBarIndex(p.time);
  const ir = c.timeToBarIndex(ref.time);
  if (ip != null && ir != null) {
    const di = ip - ir;
    if (di !== 0) {
      let r = WE.length - 2;
      for (; r >= 0 && !(WE[r] < di); --r);
      r += di > 0 ? 1 : 0;
      time = c.barIndexToTime(ir + WE[r]) ?? time;
    }
  }
  let price = p.price;
  const dp = Math.round(1e6 * (p.price - ref.price)) / 1e6;
  if (dp !== 0) {
    const lo = XE[0];
    const hi = XE[XE.length - 1];
    let o = 1;
    const s = Math.abs(dp);
    while (s < lo * o || hi * o < s) {
      if (s < lo * o) o *= 0.1;
      else if (hi * o < s) o *= 10;
    }
    let step = hi * o;
    for (let k = XE.length - 2; k >= 0 && !(XE[k] * o < s); --k) step = XE[k] * o;
    price = ref.price + (dp >= 0 ? step : -step);
  }
  return { time, price };
}

/** TV Ellipse `_calcPoint2`: the minor-axis point, on the perpendicular of the
 *  p0-p1 diameter at its middle, `radius` px away (default half the diameter
 *  = a circle). */
export function ellipsePoint2(c: Coords, a: Pt, b: Pt, radius?: number): DataPoint | null {
  const ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
  const r = radius ?? Math.hypot(b.x - a.x, b.y - a.y) / 2;
  return unproject(c, { x: (a.x + b.x) / 2 + Math.cos(ang) * r, y: (a.y + b.y) / 2 + Math.sin(ang) * r });
}

/** Shift while placing (TV `_preparePoint` / `addPoint` per tool). `placed` =
 *  the committed points (>= 1). Returns the constrained new point; for the
 *  ellipse also the minor-axis point that completes it as a circle (TV adds it
 *  at once, so the ellipse ends after 2 clicks). */
export function shiftPlacementPoint(
  kind: DrawingKind,
  placed: DataPoint[],
  p: DataPoint,
  c: Coords,
): { point: DataPoint; extra?: DataPoint } {
  const n = placed.length;
  if (n === 0) return { point: p };
  if (SNAP_45_KINDS.has(kind)) return { point: snapPoint45(c, p, placed[n - 1]) };
  if (SECOND_POINT_ONLY.has(kind)) return { point: n === 1 ? snapPoint45(c, p, placed[0]) : p };
  if (kind === "rectangle") return { point: n === 1 ? snapPointSquare(c, p, placed[0]) : p };
  if (kind === "gann-box") return { point: gannFixedIncrement(c, p, placed[0]) };
  if (kind === "ellipse" && n === 1) {
    const point = snapPoint45(c, p, placed[0]);
    const a = projectPoint(c, placed[0]);
    const b = projectPoint(c, point);
    const extra = a && b ? ellipsePoint2(c, a, b) : null;
    return extra ? { point, extra } : { point };
  }
  return { point: p };
}

/** TV Shift body move (`_alignPointHorizontallyOrVertically`): from the drag
 *  start, below 10 px on both axes the move is free, else it keeps only the
 *  larger axis (a tie moves horizontally). Decided again on every move. */
export function lockAxisDelta(dx: number, dy: number): { dx: number; dy: number } {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < 10 && ay < 10) return { dx, dy };
  return ax < ay ? { dx: 0, dy } : { dx, dy: 0 };
}

/** Screen point of `dp`, or `fallback` when it can't be projected. */
function screenOf(c: Coords, dp: DataPoint | null, fallback: Pt): Pt {
  return (dp && projectPoint(c, dp)) || fallback;
}

/** Shift on an ANCHOR drag (TV `setPoint` per tool). Either adjusts the cursor
 *  the regular anchor path then applies (`cursor`), or returns the finished
 *  drawing (`drawing`, for rules that also rewrite other points). */
export function shiftAnchorDrag(
  state: DragState,
  cursor: Pt,
  c: Coords,
): { cursor: Pt; drawing?: Drawing | null } {
  const d = state.start;
  if (state.mode.hit !== "handle") return { cursor };
  const idx = state.mode.handleIndex;
  const pts = d.points;
  const S = state.startScreen;
  const at = (q: Pt) => unproject(c, q);
  // Snap the dragged point against `ref` (data space), cursor-follow model.
  const snapTo = (ref: DataPoint | undefined, snapFn = snapPoint45) => {
    const m = at(cursor);
    if (!ref) return { cursor };
    return { cursor: m ? screenOf(c, snapFn(c, m, ref), cursor) : cursor };
  };
  // Snap for the delta-driven anchors (the anchor moves by the cursor delta).
  const snapDelta = (anchor: Pt, ref: DataPoint | undefined) => {
    if (!ref) return { cursor };
    const moved = { x: anchor.x + cursor.x - state.startCursor.x, y: anchor.y + cursor.y - state.startCursor.y };
    const m = at(moved);
    if (!m) return { cursor };
    const s = screenOf(c, snapPoint45(c, m, ref), moved);
    return { cursor: { x: state.startCursor.x + s.x - anchor.x, y: state.startCursor.y + s.y - anchor.y } };
  };
  switch (d.kind) {
    case "circle": {
      // TV: the centre anchor is a MovePoint (a body move → H/V lock); the
      // radius point snaps 45° around the centre.
      if (idx === 1) return snapTo(pts[0]);
      if (idx === 0 && S[0]) {
        const l = lockAxisDelta(cursor.x - S[0].x, cursor.y - S[0].y);
        return { cursor: { x: S[0].x + l.dx, y: S[0].y + l.dy } };
      }
      return { cursor };
    }
    case "rotated-rectangle":
      // Ends against each other; the 4 corners map to TV point 2 (vs point 1).
      if (idx === 0) return snapTo(pts[1]);
      return snapTo(pts[idx === 1 ? 0 : 1]);
    case "parallel-channel": {
      // TV `_snapPointBeforeChange`: 0/1 against the other end, 2 against the
      // virtual point 3 (p1 + channel offset), 3 against point 2.
      const [aS, bS, cS] = S;
      if (!aS || !bS || !cS) return { cursor };
      const p3S = { x: bS.x + cS.x - aS.x, y: bS.y + cS.y - aS.y };
      const p3 = at(p3S);
      if (idx === 0) return snapDelta(aS, pts[1]);
      if (idx === 1) return snapDelta(bS, pts[0]);
      if (idx === 2 && p3) return snapDelta(cS, p3);
      if (idx === 3) return snapDelta(p3S, pts[2]);
      return { cursor };
    }
    case "flat-top-bottom":
    case "disjoint-channel":
      // TV: only anchor 1 snaps (against point 0).
      return idx === 1 ? snapTo(pts[0]) : { cursor };
    case "ellipse":
      return { cursor, drawing: idx <= 1 ? ellipseAnchorDrag(state, cursor, c, true) : undefined };
    case "rectangle": {
      if (S.length !== 2) return { cursor };
      const cs = bboxCorners(S[0], S[1]);
      if (idx < 4) {
        const opp = at(cs[(idx + 2) % 4]);
        return opp ? snapTo(opp, snapPointSquare) : { cursor };
      }
      return { cursor, drawing: rectangleMiddleShift(state, cursor, c) };
    }
    case "gann-box": {
      if (S.length !== 2 || idx >= 4) return { cursor };
      const opp = at(bboxCorners(S[0], S[1])[(idx + 2) % 4]);
      return opp ? snapTo(opp, gannFixedIncrement) : { cursor };
    }
    case "gann-square":
      return { cursor, drawing: idx <= 1 ? gannSquareKeepRatio(state, cursor, c) : undefined };
  }
  if (SNAP_45_KINDS.has(d.kind) && idx <= 1 && pts.length >= 2) return snapTo(pts[idx === 0 ? 1 : 0]);
  return { cursor };
}

/** TV Ellipse.setPoint for anchors 0 / 1: the dragged end (snapped 45° with
 *  Shift), then point 2 rebuilt on the perpendicular — half the diameter with
 *  Shift (a circle), else the minor radius at drag start. With Shift and a
 *  vertical diameter, `_fixVerticalDiameterPoints` sets the moved end's price
 *  so the diameter = 2 × the p2 offset. */
export function ellipseAnchorDrag(
  state: DragState,
  cursor: Pt,
  c: Coords,
  shift: boolean,
  snap: (p: DataPoint) => DataPoint = (p) => p,
): Drawing | null {
  const d = state.start;
  if (d.kind !== "ellipse" || state.mode.hit !== "handle") return null;
  const idx = state.mode.handleIndex;
  const [a0, b0, c0] = state.startScreen;
  if (!a0 || !b0 || !c0 || idx > 1) return null;
  const m0 = unproject(c, cursor);
  if (!m0) return null;
  const other = d.points[idx === 0 ? 1 : 0];
  const moved = shift ? snapPoint45(c, m0, other) : snap(m0);
  const pts = [...d.points] as DataPoint[];
  pts[idx] = moved;
  const a = projectPoint(c, pts[0]);
  const b = projectPoint(c, pts[1]);
  if (!a || !b) return null;
  // Minor radius at drag start (TV `_radius2` = distance of p2 to line p0-p1).
  const ux = b0.x - a0.x;
  const uy = b0.y - a0.y;
  const ul = Math.hypot(ux, uy) || 1;
  const r2 = Math.abs(((c0.x - a0.x) * uy - (c0.y - a0.y) * ux) / ul);
  const p2 = ellipsePoint2(c, a, b, shift ? undefined : r2);
  if (!p2) return null;
  pts[2] = p2;
  if (shift && c.timeToBarIndex(pts[0].time) === c.timeToBarIndex(pts[1].time)) {
    const t = pts[idx];
    const e = pts[idx === 0 ? 1 : 0];
    const tS = projectPoint(c, t);
    const eS = projectPoint(c, e);
    const l = c.timeToX(t.time);
    const x2 = c.timeToX(p2.time);
    if (tS && eS && l != null && x2 != null) {
      const len = 2 * Math.abs(l - x2) * (e.price > t.price ? 1 : -1);
      const price = c.yToPrice(eS.y + len);
      if (price != null) pts[idx] = { time: t.time, price };
    }
  }
  return replaceDrawingPoints(d, pts);
}

/** TV Gann square ("GannComplex") setPoint with Shift: the dragged end keeps
 *  its side of the other end and the stored price-per-bar ratio (here the
 *  ratio at drag start): price = other ± |Δbars| · ratio. */
function gannSquareKeepRatio(state: DragState, cursor: Pt, c: Coords): Drawing | null {
  const d = state.start;
  if (state.mode.hit !== "handle") return null;
  const idx = state.mode.handleIndex;
  const [p0, p1] = d.points;
  const i0 = c.timeToBarIndex(p0.time);
  const i1 = c.timeToBarIndex(p1.time);
  const m = unproject(c, cursor);
  if (!m || i0 == null || i1 == null || i0 === i1) return null;
  const ratio = Math.abs(p1.price - p0.price) / Math.abs(i1 - i0);
  const other = idx === 0 ? p1 : p0;
  const im = c.timeToBarIndex(m.time);
  const io = c.timeToBarIndex(other.time);
  if (im == null || io == null) return null;
  const pts = [...d.points] as DataPoint[];
  pts[idx] = { time: m.time, price: other.price + (m.price - other.price > 0 ? 1 : -1) * Math.abs(im - io) * ratio };
  return replaceDrawingPoints(d, pts);
}

/** TV Rectangle middle anchors with Shift. Left / right (OT 7 / 5,
 *  `_correctRightLeftMiddlePoint`): the edge follows the cursor and the height
 *  changes by the same pixels, split between top and bottom. Top / bottom
 *  (OT 4 / 6, `_correctTopBottomMiddlePoint`): TV moves both side edges out by
 *  whole bars and the dragged edge by the pixel width of those bars; TV applies
 *  it step by step on each move, here its end state from the drag start:
 *  k = round(cursor distance / bar spacing) bars on each side. */
function rectangleMiddleShift(state: DragState, cursor: Pt, c: Coords): Drawing | null {
  const d = state.start;
  if (state.mode.hit !== "handle") return null;
  const [tl, , br] = bboxCorners(state.startScreen[0], state.startScreen[1]);
  let { x: left, y: top } = tl;
  let { x: right, y: bottom } = br;
  const idx = state.mode.handleIndex;
  if (idx === 5 || idx === 7) {
    const cdx = idx === 5 ? cursor.x - right : left - cursor.x; // > 0 = wider
    if (idx === 5) right += cdx;
    else left -= cdx;
    top -= cdx / 2;
    bottom += cdx / 2;
  } else {
    const grow = idx === 4 ? top - cursor.y : cursor.y - bottom; // > 0 = taller
    const lb = barAtX(c, left);
    const rb = barAtX(c, right);
    if (!lb || !rb) return null;
    const next = barAtIndex(c, rb.i + 1);
    const spacing = next ? next.x - rb.x : 0;
    if (spacing <= 0) return null;
    const k = Math.round(grow / spacing);
    const nl = barAtIndex(c, lb.i - k);
    const nr = barAtIndex(c, rb.i + k);
    if (!nl || !nr) return null;
    const px = nr.x - rb.x;
    left = nl.x;
    right = nr.x;
    if (idx === 4) top -= px;
    else bottom += px;
  }
  const a = unproject(c, { x: left, y: top });
  const b = unproject(c, { x: right, y: bottom });
  if (!a || !b) return null;
  return replaceDrawingPoints(d, [a, b]);
}
