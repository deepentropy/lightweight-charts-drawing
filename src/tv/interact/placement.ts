/*
 * Placement of a new drawing (moved from OpenTrader DrawingsOverlay, port
 * phase 3): the clicked points -> the drawing of a kind (point model per
 * tool), then the data TV computes at placement (position levels, bar-pattern
 * snapshot, ghost-feed seed, curve controls, trend angle, Gann square).
 */
import type { Time } from "lightweight-charts";
import { timeToSec } from "../_shared";
import type { Coords } from "../coords";
import type { DataPoint, DrawingKind } from "../types";
import { defaultStyleFor } from "../specs";
import { barsBetween } from "../kinds/data-series";
import { projectPoint, screenAngleDeg, unproject } from "./project";

/** Straight single-segment 2-point line tools whose second point honours TV's
 *  Shift-to-snap-angle constraint (the line locks to 0/45/90/… while drawing). */
export const ANGLE_SNAP_KINDS = new Set<DrawingKind>([
  "trend-line", "ray", "extended-line", "info-line", "trend-angle", "arrow",
  // circle: the radius point snaps 45° around the center (TV's
  // snapTo45DegreesAvailable on LineToolCircle).
  "circle",
]);

/** 3-point kinds whose in-flight point honours the Shift 45°-step constraint
 *  around the PREVIOUS point (placement and anchor drags — TV parity). */
export const ANGLE_SNAP_3PT_KINDS = new Set<DrawingKind>([
  "pitchfork", "schiff-pitchfork", "modified-schiff-pitchfork", "inside-pitchfork",
  "pitchfan", "triangle", "trend-based-fib-extension",
]);

/** Pattern / Elliott polylines keep the plain-segment rubber-band while
 *  placing (TV also shows connected segments for these, not the finished
 *  labeled shape); every other fixed-arity kind previews the REAL tool. */
export const SEGMENT_PREVIEW_KINDS = new Set<DrawingKind>([
  "abcd-pattern", "xabcd-pattern", "cypher-pattern", "head-and-shoulders",
  "triangle-pattern", "three-drives-pattern",
  "elliott-impulse", "elliott-correction", "elliott-triangle",
  "elliott-double-combo", "elliott-triple-combo",
]);

/** ---------- placement helpers ---------- */

export function buildNewDrawing(
  kind: import("../types").DrawingKind,
  pts: DataPoint[],
): import("../types").NewDrawing | null {
  // The case grouping guarantees the tuple arity matches `kind`, but TS won't
  // distribute a fresh object literal with a union-typed discriminant over the
  // (now large) NewDrawing union, so each return is cast to the union.
  type NewDrawing = import("../types").NewDrawing;
  switch (kind) {
    case "horizontal-line":
    case "horizontal-ray":
    case "vertical-line":
    case "cross-line":
    case "arrow-mark-up":
    case "arrow-mark-down":
    case "price-label":
    case "flag-mark":
    case "text":
    case "pin":
    case "comment":
    case "signpost":
    case "font-icon":
    case "table":
    case "image":
    case "anchored-vwap":
      return { kind, points: [pts[0]] } as NewDrawing;
    case "price-note":
      // 2-point tool (TV): p0 carries the price bubble, p0-p1 is the line.
      return { kind, points: [pts[0], pts[1]] } as NewDrawing;
    case "note":
      // TV Note (LineToolTextNote): 2 clicks — anchor, then the text label.
      return { kind, points: [pts[0], pts[1]] } as NewDrawing;
    case "long-position":
    case "short-position":
      // 1-click tool (TV): the close point starts AT the entry; the placement
      // path (enrichPositionPlacement) then sizes the box + default levels
      // from the chart, which buildNewDrawing has no coords for.
      return { kind, points: [pts[0], { ...pts[0] }] } as NewDrawing;
    case "parallel-channel": {
      // Re-anchor the 3rd click to p0's time (TV `_convertLastPointTo3rdPoint`):
      // the offset point rides the first anchor, so later endpoint drags keep
      // the channel height without extra bookkeeping. Time-proportional
      // interpolation stands in for the x-fraction (times are epoch seconds).
      const [a, b, c] = pts;
      const t0 = Number(a.time), t1 = Number(b.time), tc = Number(c.time);
      if (Number.isFinite(t0) && Number.isFinite(t1) && Number.isFinite(tc) && t1 !== t0) {
        const t = (tc - t0) / (t1 - t0);
        const dy = c.price - (a.price + (b.price - a.price) * t);
        return { kind, points: [a, b, { time: a.time, price: a.price + dy }] } as NewDrawing;
      }
      return { kind, points: [a, b, c] } as NewDrawing;
    }
    case "arrow-marker":
    case "trend-line":
    case "ray":
    case "extended-line":
    case "info-line":
    case "trend-angle":
    case "gann-fan":
    case "gann-box":
    case "gann-square-fixed":
    case "gann-square":
    case "fib-time-zone":
    case "fib-speed-resistance-fan":
    case "fib-speed-resistance-arcs":
    case "fib-spiral":
    case "cyclic-lines":
    case "sine-line":
    case "time-cycles":
    case "arrow":
    case "rectangle":
    case "fib-retracement":
    case "price-range":
    case "date-range":
    case "date-and-price-range":
    case "position-forecast":
    case "bar-pattern":
    case "callout":
    case "regression-trend":
    case "fixed-range-volume-profile":
      return { kind, points: [pts[0], pts[1]] } as NewDrawing;
    case "anchored-volume-profile":
      // TV: 1 click — the profile runs from the anchor bar to the last bar.
      return { kind, points: [pts[0]] } as NewDrawing;
    case "circle":
      // TV model: click 1 = center, click 2 = radius point. fmt 2 tags the
      // entry as the current point model (see migrateDrawing).
      return { kind, points: [pts[0], pts[1]], fmt: 2 } as NewDrawing;
    case "arc":
      // TV model: clicks 1-2 = chord ends, click 3 = bulge.
      return { kind, points: [pts[0], pts[1], pts[2]], fmt: 2 } as NewDrawing;
    case "fib-circles":
      // TV model: ellipses centred on the p0-p1 midpoint (fmt 2); older
      // entries keep the circles-around-p0 model (renderFibCircles).
      return { kind, points: [pts[0], pts[1]], fmt: 2 } as NewDrawing;
    case "rotated-rectangle":
      // TV model: clicks 1-2 = the centre line, click 3 = half-width (its
      // distance to that line). fmt 2 tags it; older entries keep the
      // side + offset model (renderRotatedRectangle).
      return { kind, points: [pts[0], pts[1], pts[2]], fmt: 2 } as NewDrawing;
    case "triangle":
    case "pitchfork":
    case "schiff-pitchfork":
    case "modified-schiff-pitchfork":
    case "inside-pitchfork":
    case "trend-based-fib-extension":
    case "trend-based-fib-time":
    case "sector":
    // Disjoint channel keeps the raw 3rd click (TV stores it as clicked; the
    // mirror geometry reads only its price) — not the parallel-channel re-anchor.
    case "disjoint-channel":
    case "flat-top-bottom":
    case "fib-channel":
    case "fib-wedge":
    case "pitchfan":
    case "ellipse":
      return { kind, points: [pts[0], pts[1], pts[2]] } as NewDrawing;
    case "curve": {
      // 2 clicks (TV): the control point is auto-derived (midpoint; the
      // placement path then offsets it perpendicular in screen space) and
      // stays draggable as the middle anchor.
      const mid = { time: ((Number(pts[0].time) + Number(pts[1].time)) / 2) as unknown as Time, price: (pts[0].price + pts[1].price) / 2 };
      return { kind, points: [pts[0], mid, pts[1]] } as NewDrawing;
    }
    case "double-curve": {
      // 2 clicks (TV): both cubic controls auto-derived at the thirds; the
      // placement path offsets them perpendicular in screen space.
      const t0 = Number(pts[0].time), t1 = Number(pts[1].time);
      const c1 = { time: (t0 + (t1 - t0) / 3) as unknown as Time, price: pts[0].price + (pts[1].price - pts[0].price) / 3 };
      const c2 = { time: (t0 + ((t1 - t0) * 2) / 3) as unknown as Time, price: pts[0].price + ((pts[1].price - pts[0].price) * 2) / 3 };
      return { kind, points: [pts[0], c1, c2, pts[1]] } as NewDrawing;
    }
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
    case "brush":
    case "highlighter":
    case "ghost-feed":
      return { kind, points: pts.slice() } as NewDrawing;
  }
  return null;
}

/** TV's 1-click position placement: freeze stop = profit = 20% of the visible
 *  price range (pip-rounded) into the style, and put the close point at the
 *  entry bar + max(3, round(0.15 · bars visible in the pane)) — TV
 *  line-tool-risk-reward `_getClosePointIndex` (paneWidth / barSpacing). */
export function enrichPositionPlacement(
  placed: import("../types").NewDrawing,
  kind: "long-position" | "short-position",
  coords: Coords,
  paneW: number,
  paneH: number,
): import("../types").NewDrawing {
  const entry = placed.points[0];
  const pip = coords.pipSize();
  const pTop = coords.yToPrice(0);
  const pBot = coords.yToPrice(Math.max(1, paneH));
  const range = pTop != null && pBot != null ? Math.abs(pTop - pBot) : 0;
  const level = Math.max(pip, Math.round(((range || pip * 500) * 0.2) / pip) * pip);
  // Close point: entry index + max(3, round(0.15 · visible bars)); the bar
  // spacing is measured between two neighbouring bar times.
  const bars = coords.bars();
  const entryIdx = coords.timeToBarIndex(entry.time) ?? bars.length;
  const tA = coords.barIndexToTime(entryIdx);
  const tB = coords.barIndexToTime(entryIdx + 1);
  const xA = tA != null ? coords.timeToX(tA) : null;
  const xB = tB != null ? coords.timeToX(tB) : null;
  const spacing = xA != null && xB != null ? Math.abs(xB - xA) : 0;
  const visibleBars = spacing > 0 ? Math.round(paneW / spacing) : 0;
  const closeIdx = entryIdx + Math.max(3, Math.round(0.15 * visibleBars));
  const closeTime: Time = coords.barIndexToTime(closeIdx) ?? entry.time;
  const style = { ...defaultStyleFor(kind), stopLevel: level, profitLevel: level };
  return {
    ...placed,
    points: [entry, { time: closeTime, price: entry.price }],
    style,
  } as import("../types").NewDrawing;
}

/** Freeze the bars covered by a fresh bar-pattern (TV keeps a snapshot; the
 *  copy must not re-sample live data as it is dragged around). TV placement
 *  (`_preparePoint` + `addPoint`): the points snap to the first / last bar of
 *  the range, P0 = the first bar's high (HL bars mode) raised by 5% of the
 *  price-scale height, P1 = P0 + (last pattern price − first pattern price). */
export function enrichBarPattern(
  placed: import("../types").NewDrawing,
  coords: Coords,
  scaleHeight: number,
): import("../types").NewDrawing {
  const p1 = placed.points[1];
  if (!p1) return placed;
  const t0 = timeToSec(placed.points[0].time);
  const t1 = timeToSec(p1.time);
  if (t0 == null || t1 == null) return placed;
  const rows = barsBetween(coords.bars(), Math.min(t0, t1), Math.max(t0, t1));
  if (rows.length === 0) return placed;
  const first = rows[0];
  const last = rows[rows.length - 1];
  const yHigh = coords.priceToY(first.high);
  const price0 = yHigh != null ? (coords.yToPrice(yHigh - 0.05 * scaleHeight) ?? first.high) : first.high;
  const price1 = price0 + (last.low - first.high);
  return {
    ...placed,
    points: [
      { time: first.time, price: price0 },
      { time: last.time, price: price1 },
    ],
    pattern: {
      base: first.open,
      bars: rows.map((b) => [b.open, b.high, b.low, b.close] as [number, number, number, number]),
    },
  } as import("../types").NewDrawing;
}

/** Freeze a fresh ghost-feed's generation params: a random seed + the mean
 *  bar range of the last 14 real bars (the TV `averageHL` ≈ ATR init). */
export function enrichGhostFeed(
  placed: import("../types").NewDrawing,
  coords: Coords,
): import("../types").NewDrawing {
  // TV `_calculateATR`: mean high − low over all loaded bars, rounded to whole
  // ticks (averageHL is an integer in ticks).
  const bars = coords.bars();
  const pip = coords.pipSize();
  const mean = bars.length > 0 ? bars.reduce((s, b) => s + (b.high - b.low), 0) / bars.length : 0;
  const amp = mean > 0 ? Math.max(1, Math.round(mean / pip)) * pip : Math.abs(placed.points[0].price) * 0.01 || 1;
  return {
    ...placed,
    ghost: { seed: Math.floor(Math.random() * 0x7fffffff), amplitude: amp },
  } as import("../types").NewDrawing;
}

/** Offset a curve's auto-derived control point(s) perpendicular to the chord
 *  in screen space (TV: 0.15 x chord length). */
export function enrichCurvePlacement(
  placed: import("../types").NewDrawing,
  coords: Coords,
): import("../types").NewDrawing {
  const first = placed.points[0];
  const last = placed.points[placed.points.length - 1];
  if (!first || !last) return placed;
  const a = projectPoint(coords, first);
  const b = projectPoint(coords, last);
  if (!a || !b) return placed;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * len * 0.15;
  const py = (dx / len) * len * 0.15;
  const bend = (t: number): DataPoint | null =>
    unproject(coords, { x: a.x + dx * t + px, y: a.y + dy * t + py });
  if (placed.kind === "curve") {
    const c = bend(0.5);
    if (!c) return placed;
    return { ...placed, points: [placed.points[0], c, placed.points[2]] } as import("../types").NewDrawing;
  }
  if (placed.kind === "double-curve") {
    const c1 = bend(1 / 3);
    const c2 = bend(2 / 3);
    if (!c1 || !c2) return placed;
    return { ...placed, points: [placed.points[0], c1, c2, placed.points[3]] } as import("../types").NewDrawing;
  }
  return placed;
}

/** Freeze a fresh trend-angle's readout (TV stores `angle` computed in SCREEN
 *  space and keeps it through zooms; only anchor drags re-derive it). */
export function enrichTrendAngle(
  placed: import("../types").NewDrawing,
  coords: Coords,
): import("../types").NewDrawing {
  const a = projectPoint(coords, placed.points[0]);
  const b = placed.points[1] ? projectPoint(coords, placed.points[1]) : null;
  if (!a || !b) return placed;
  return {
    ...placed,
    style: { ...(placed.style ?? defaultStyleFor("trend-angle")), angle: screenAngleDeg(a, b) },
  } as import("../types").NewDrawing;
}

/** Gann square (TV addPoint / setLastPoint `_correctPoint(1)`): p1's price =
 *  p0's price ± |bars| · ratio, keeping the cursor's side, with ratio = the
 *  price per bar that makes a screen square now (TV scaleRatio: bar spacing /
 *  pixels per price). Not on a log scale (TV). */
export function snapGannSquare<T extends { points: DataPoint[] }>(d: T, coords: Coords): T {
  const [p0, p1] = d.points;
  if (!p0 || !p1 || coords.isLog()) return d;
  const i0 = coords.timeToBarIndex(p0.time);
  const i1 = coords.timeToBarIndex(p1.time);
  if (i0 == null || i1 == null) return d;
  const ya = coords.priceToY(p0.price);
  const yb = coords.priceToY(p0.price + 1);
  const ta = coords.barIndexToTime(i0);
  const tb = coords.barIndexToTime(i0 + 1);
  const xa = ta != null ? coords.timeToX(ta) : null;
  const xb = tb != null ? coords.timeToX(tb) : null;
  if (ya == null || yb == null || xa == null || xb == null || ya === yb) return d;
  const ratio = Math.abs(xb - xa) / Math.abs(yb - ya);
  const sign = p1.price - p0.price >= 0 ? 1 : -1;
  return { ...d, points: [p0, { ...p1, price: p0.price + sign * Math.abs(i1 - i0) * ratio }] };
}

/** A finished placement: the clicked points -> the new drawing with the data
 *  TV computes at placement (position box, curve controls, Gann square,
 *  bar-pattern snapshot, trend angle, ghost-feed seed; polyline `closed`,
 *  font-icon glyph). `pane` = the pane size in px. */
export function finishPlacement(
  kind: DrawingKind,
  pts: DataPoint[],
  coords: Coords | null,
  pane: { w: number; h: number },
  opts: { glyph?: string; closed?: boolean } = {},
): import("../types").NewDrawing | null {
  let placed = buildNewDrawing(kind, pts);
  if (!placed) return null;
  // Position tool (TV): one click creates the whole 1:1 box — stop = profit
  // = 20% of the visible price range, close point a span forward.
  if ((kind === "long-position" || kind === "short-position") && coords) placed = enrichPositionPlacement(placed, kind, coords, pane.w, pane.h);
  // Curves (TV): the auto-derived control point(s) bow perpendicular to the
  // chord in screen space (0.15 x chord length).
  if ((kind === "curve" || kind === "double-curve") && coords) placed = enrichCurvePlacement(placed, coords);
  // Gann square (TV addPoint / setLastPoint): a screen square at this zoom.
  if (kind === "gann-square" && coords) placed = snapGannSquare(placed, coords);
  // Copy tools (TV): bar-pattern freezes the covered bars.
  if (kind === "bar-pattern" && coords) placed = enrichBarPattern(placed, coords, Math.max(1, pane.h));
  // Trend-angle (TV): the readout angle freezes in screen space.
  if (kind === "trend-angle" && coords) placed = enrichTrendAngle(placed, coords);
  // TV polyline `filled`: stored explicitly (false = open) so older saves can
  // be told apart (see migrateDrawing).
  if (kind === "polyline" && opts.closed !== undefined) placed = { ...placed, closed: opts.closed } as typeof placed;
  // Ghost-feed (a copy tool): the seed + ATR-based amplitude freeze at commit.
  if (kind === "ghost-feed" && coords) placed = enrichGhostFeed(placed, coords);
  if (kind === "font-icon") placed = { ...placed, glyph: opts.glyph } as typeof placed;
  return placed;
}
