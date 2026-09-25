/*
 * Screen <-> chart projection helpers of the drawing interaction (moved from
 * OpenTrader DrawingsOverlay, port phase 3): project / unproject points, the
 * anchored-drawing screen position, body translation, the point-tuple rebuild
 * per kind, the Shift 45-degree snap and the OHLC magnet.
 */
import type { Pt } from "../_shared";
import type { Coords } from "../coords";
import type { DataPoint, Drawing } from "../types";

/** Weak-magnet reach: snap only when the cursor is within this many screen-px
 *  of an OHLC / indicator level (TV's weak magnet). Strong magnet ignores it. */
export const MAGNET_WEAK_RADIUS_PX = 50;

/** Screen points of a drawing: its data points projected, or the TV fixed
 *  position of an anchored drawing (pane fractions x pane size). */
export function screenPoints(coords: Coords, d: Drawing, pane: { w: number; h: number }): Pt[] | null {
  if (d.anchored) return [{ x: d.anchored.x * pane.w, y: d.anchored.y * pane.h }];
  return projectAll(coords, d.points);
}

/** Body translation by a screen delta: every data point unprojected, or the
 *  fixed position of an anchored drawing (TV addFixedPoint). */
export function translateDrawing(coords: Coords, d: Drawing, startScreen: Pt[], dx: number, dy: number, pane?: { w: number; h: number }): Drawing | null {
  if (d.anchored && pane && pane.w > 0 && pane.h > 0) {
    return { ...d, anchored: { x: (startScreen[0].x + dx) / pane.w, y: (startScreen[0].y + dy) / pane.h } };
  }
  const next: DataPoint[] = [];
  for (const sp of startScreen) {
    const u = unproject(coords, { x: sp.x + dx, y: sp.y + dy });
    if (!u) return null;
    next.push(u);
  }
  return replaceDrawingPoints(d, next);
}

export function projectPoint(coords: Coords, p: DataPoint): Pt | null {
  const x = coords.timeToX(p.time);
  const y = coords.priceToY(p.price);
  if (x == null || y == null) return null;
  return { x, y };
}

export function projectAll(coords: Coords, ps: DataPoint[]): Pt[] | null {
  const out: Pt[] = [];
  for (const p of ps) {
    const sp = projectPoint(coords, p);
    if (!sp) return null;
    out.push(sp);
  }
  return out;
}

/** Constrain a screen endpoint to the nearest 45° ray from `origin`, preserving
 *  the cursor's distance along that direction (TV's Shift behaviour). Works in
 *  screen space so the angle is the visual on-screen angle, not data-space. */
export function snapAngle(origin: Pt, p: Pt): Pt {
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return p;
  const step = Math.PI / 4;
  const ang = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: origin.x + Math.cos(ang) * dist, y: origin.y + Math.sin(ang) * dist };
}

export function unproject(coords: Coords, p: Pt): DataPoint | null {
  const time = coords.xToTime(p.x);
  const price = coords.yToPrice(p.y);
  if (time == null || price == null) return null;
  // TV stores the raw price of the click (no rounding).
  return { time, price };
}

/** Snap a data point's price to the closest OHLC value of the bar under the
 *  cursor's time (plus overlay-indicator levels when `snapToIndicators`). Time
 *  stays untouched — snapping along the time axis would change which bar the
 *  drawing lives on. The closest candidate is chosen by SCREEN distance to the
 *  cursor, so the pick matches what the eye expects across uneven price scales.
 *  Returns `null` when no level is in reach — in "weak" mode that's beyond
 *  MAGNET_WEAK_RADIUS_PX; "strong" always finds one. Callers that need a value
 *  regardless fall back to the raw point (`magnetSnap(...) ?? dp`); the preview
 *  uses the null to keep the crosshair on the free cursor. */
export function magnetSnap(
  dp: DataPoint,
  coords: Coords,
  mode: "weak" | "strong",
  snapToIndicators: boolean,
): DataPoint | null {
  const bar = coords.barAt(dp.time);
  if (!bar) return null;
  const candidates = [bar.open, bar.high, bar.low, bar.close];
  if (snapToIndicators) {
    for (const v of coords.indicatorValuesAt(bar.time)) candidates.push(v);
  }
  // Prefer screen-distance ranking; fall back to price distance if the cursor
  // price can't be projected (pre-layout).
  const cursorY = coords.priceToY(dp.price);
  let best = bar.close;
  let bestDy = Infinity;
  for (const v of candidates) {
    const vy = coords.priceToY(v);
    const dy = cursorY != null && vy != null ? Math.abs(vy - cursorY) : Math.abs(dp.price - v);
    if (dy < bestDy) {
      bestDy = dy;
      best = v;
    }
  }
  // Weak magnet only engages when a level is within reach (in screen-px when
  // available, else a price-proportional fallback).
  if (mode === "weak" && cursorY != null && bestDy >= MAGNET_WEAK_RADIUS_PX) return null;
  return { time: dp.time, price: best };
}

/** Replace points[index] in a drawing while preserving the discriminated-
 *  union tuple type. Re-creates the array as a same-arity tuple. */
export function replaceDrawingPoints(d: Drawing, points: DataPoint[]): Drawing {
  // Re-spread under the existing `kind` so the resulting object matches the
  // tuple arity for that kind. Caller guarantees `points.length` matches.
  switch (d.kind) {
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
      return { ...d, points: [points[0]] };
    case "price-note":
    case "note":
      return { ...d, points: [points[0], points[1]] };
    case "arrow-marker":
    case "trend-line":
    case "ray":
    case "extended-line":
    case "info-line":
    case "trend-angle":
    case "long-position":
    case "short-position":
    case "gann-fan":
    case "gann-box":
    case "gann-square-fixed":
    case "gann-square":
    case "fib-time-zone":
    case "fib-circles":
    case "fib-speed-resistance-fan":
    case "fib-speed-resistance-arcs":
    case "fib-spiral":
    case "cyclic-lines":
    case "sine-line":
    case "time-cycles":
    case "arrow":
    case "rectangle":
    case "circle":
    case "fib-retracement":
    case "price-range":
    case "date-range":
    case "date-and-price-range":
    case "position-forecast":
    case "bar-pattern":
    case "callout":
    case "regression-trend":
    case "fixed-range-volume-profile":
      return { ...d, points: [points[0], points[1]] };
    case "anchored-volume-profile":
      return { ...d, points: [points[0]] };
    case "triangle":
    case "parallel-channel":
    case "pitchfork":
    case "schiff-pitchfork":
    case "modified-schiff-pitchfork":
    case "inside-pitchfork":
    case "trend-based-fib-extension":
    case "trend-based-fib-time":
    case "sector":
    case "disjoint-channel":
    case "flat-top-bottom":
    case "fib-channel":
    case "rotated-rectangle":
    case "curve":
    case "fib-wedge":
    case "pitchfan":
    case "ellipse":
    case "arc":
      return { ...d, points: [points[0], points[1], points[2]] };
    case "double-curve":
      return { ...d, points: [points[0], points[1], points[2], points[3]] };
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
      // Variable-arity polylines: preserve whatever vertex count the drag
      // hands back (body drag + per-point drag both keep the length).
      return { ...d, points };
  }
}

/** Screen-space angle of a→b in degrees, y-up (0° = right, 90° = up). */
export function screenAngleDeg(a: Pt, b: Pt): number {
  return (Math.atan2(-(b.y - a.y), b.x - a.x) * 180) / Math.PI;
}
