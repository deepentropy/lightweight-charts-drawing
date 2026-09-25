/*
 * Shared geometry + formatting helpers used by every per-kind hit-test
 * module and by DrawingsOverlay's render switch. No JSX, no Solid — pure
 * functions so the overlay (which holds the SVG JSX) can mix-and-match.
 */
import type { Time } from "lightweight-charts";
import type { DrawingStyle } from "./types";

export type Pt = { x: number; y: number };

/** Anchor radius in px — TV `RegularAnchorRadius` (lt-pane-views). */
export const HANDLE_RADIUS = 6;
/** Slop added to every hit-test so thin strokes are still grabbable. */
export const HIT_TOLERANCE = 6;
/** Half-extent of the bbox around a 1-point glyph (arrow-mark-up / -down,
 *  price-label) used both for rendered size and hit-testing. */
export const GLYPH_HALF = 9;

export type HitResult =
  | { hit: "handle"; handleIndex: number }
  | { hit: "body"; cell?: [number, number] };

/** Translate a line-style enum into an SVG stroke-dasharray. */
export function dashFor(style: DrawingStyle): string | undefined {
  if (style.lineStyle === "dashed") return "6 4";
  if (style.lineStyle === "dotted") return "2 3";
  return undefined;
}

/** Stroke hit slop scaled with the drawing's line width, so a fat stroke is
 *  grabbable across its whole painted body (TV: tolerance + linewidth / 2). */
export function strokeTolerance(style: DrawingStyle | undefined): number {
  return Math.max(HIT_TOLERANCE, (style?.width ?? 1) / 2 + 2);
}

/** Resolve a shape's interior fill from the TV-faithful params
 *  (`fillBackground` / `backgroundColor` / `transparency`), falling back to the
 *  legacy stroke-colour @ 0.08 so shapes with no fill params render as before.
 *  Returns SVG `fill` + `fillOpacity`. */
export function fillStyle(style: DrawingStyle): { fill: string; fillOpacity: number } {
  if (style.fillBackground === false) return { fill: "none", fillOpacity: 0 };
  const fill = style.backgroundColor || style.color;
  const fillOpacity =
    style.transparency != null ? Math.max(0, Math.min(1, (100 - style.transparency) / 100)) : 0.08;
  return { fill, fillOpacity };
}

/** Distance from a point to a segment, used by line-body hit-tests. */
export function distToSegment(px: number, py: number, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - a.x, py - a.y);
  let t = ((px - a.x) * dx + (py - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

/** Ray-cast point-in-polygon, used by the triangle body hit-test. */
export function pointInPolygon(px: number, py: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Four bbox corners (TL/TR/BR/BL) from two opposite-corner points. Shared
 *  by every bbox kind (rectangle, circle, date-and-price-range) for both
 *  rendering the visual handles and the corner-remap drag math. */
export function bboxCorners(a: Pt, b: Pt): [Pt, Pt, Pt, Pt] {
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const bottom = Math.max(a.y, b.y);
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

/** Best-effort time → seconds-since-epoch for date-range deltas. Handles the
 *  three lightweight-charts `Time` representations; returns null if the
 *  representation is unknown. */
export function timeToSec(t: Time): number | null {
  if (typeof t === "number") return t;
  if (typeof t === "string") {
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? ms / 1000 : null;
  }
  if (typeof t === "object" && t !== null && "year" in t) {
    return Date.UTC(t.year, t.month - 1, t.day) / 1000;
  }
  return null;
}

/** "+1.23 (+0.45%)"-style label used by every price-measurement tool. */
export function formatPriceDelta(a: number, b: number): string {
  const d = b - a;
  const pct = a !== 0 ? (d / a) * 100 : 0;
  const sign = d >= 0 ? "+" : "";
  return `${sign}${d.toFixed(2)} (${sign}${pct.toFixed(2)}%)`;
}

/** "3 d" / "2 h" / "12 m" / "30 s"-style label for date-range tools.
 *  Returns "" when the time representation isn't decodable. */
export function formatTimeDelta(a: Time, b: Time): string {
  const sa = timeToSec(a);
  const sb = timeToSec(b);
  if (sa == null || sb == null) return "";
  const sec = Math.abs(sb - sa);
  if (sec >= 86400) return `${(sec / 86400).toFixed(sec >= 86400 * 10 ? 0 : 1)} d`;
  if (sec >= 3600) return `${(sec / 3600).toFixed(sec >= 3600 * 10 ? 0 : 1)} h`;
  if (sec >= 60) return `${Math.round(sec / 60)} m`;
  return `${Math.round(sec)} s`;
}
