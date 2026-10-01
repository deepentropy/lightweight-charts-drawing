/*
 * Shared hit-test for 1-point glyph kinds (arrow-mark-up/-down, price-label,
 * font-icon). Each renders inside a square bbox of side 2*GLYPH_HALF
 * centered on the click point; the body is hittable anywhere inside that
 * bbox (with HIT_TOLERANCE slop). Handle = the click point itself.
 */
import {
  GLYPH_HALF,
  HANDLE_RADIUS,
  HIT_TOLERANCE,
  type HitResult,
  type Pt,
} from "../_shared";

export function glyphHitTest(pts: Pt[], cursor: Pt): HitResult | null {
  const c = pts[0];
  if (Math.hypot(c.x - cursor.x, c.y - cursor.y) <= HANDLE_RADIUS + HIT_TOLERANCE) {
    return { hit: "handle", handleIndex: 0 };
  }
  if (
    Math.abs(cursor.x - c.x) <= GLYPH_HALF + HIT_TOLERANCE &&
    Math.abs(cursor.y - c.y) <= GLYPH_HALF + HIT_TOLERANCE
  ) {
    return { hit: "body" };
  }
  return null;
}
