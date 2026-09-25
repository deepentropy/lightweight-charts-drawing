/*
 * Rotated-rectangle geometry shared by the renderer and the hit test.
 */
import type { Pt } from "./_shared";

/** Rotated rectangle corners.
 *  fmt 2 (TV line-tool-rotated-rectangle): p0→p1 is the CENTRE line, the half
 *  width is p2's distance to it; corners = p0/p1 ± perp·d.
 *  Older entries: p0→p1 is one side and p2 sets the perpendicular offset. */
export function rotatedRectCorners(pts: Pt[], fmt2: boolean): Pt[] {
  const [a, b, c] = pts;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // TV perp = (dy, −dx) normalised.
  const nx = dy / len;
  const ny = -dx / len;
  if (fmt2) {
    const d = c ? Math.abs((c.x - a.x) * nx + (c.y - a.y) * ny) : 0;
    return [
      { x: a.x + nx * d, y: a.y + ny * d },
      { x: b.x + nx * d, y: b.y + ny * d },
      { x: b.x - nx * d, y: b.y - ny * d },
      { x: a.x - nx * d, y: a.y - ny * d },
    ];
  }
  const off = c ? (c.x - b.x) * -nx + (c.y - b.y) * -ny : 0;
  return [a, b, { x: b.x - nx * off, y: b.y - ny * off }, { x: a.x - nx * off, y: a.y - ny * off }];
}
