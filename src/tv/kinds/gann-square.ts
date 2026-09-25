/*
 * Gann square / Gann square fixed geometry (TV LineToolGannComplex, module
 * 884210, and LineToolGannFixed, module 86825, read live 25/09/2026), shared
 * by the overlay renderer and the hit test.
 *
 * Box: Gann square = p0 → p1 (start / end swapped when Reverse is on); Gann
 * square fixed = p0 → p0 + 5·|p0p1| on both axes, towards p1's quadrant
 * (screen px, so always a screen square; Reverse swaps the stored points).
 * Levels: vertical + horizontal lines at index / 5 of the box.
 * Fans: from the start to (end.x, start.y + y/x·dy) when x > y, else to
 * (start.x + x/y·dx, end.y).
 * Arcs (TV GannArcRenderer): quarter ellipse around the start in the end's
 * quadrant, the unit circle scaled by the box ratio dy/dx; radius from the
 * point (x/5, y/5) of the box; clipped to the box; the fill runs from the
 * previous visible arc to this one.
 */
import type { Drawing, GannLine, GannRatioLine } from "../types";
import type { Pt } from "../_shared";

export type GannFrame = { start: Pt; end: Pt; dx: number; dy: number };

export function gannFrame(d: Drawing, pts: Pt[]): GannFrame | null {
  const [p0, p1] = pts;
  if (!p0 || !p1) return null;
  if (d.kind === "gann-square-fixed") {
    const vx = p1.x - p0.x;
    const vy = p1.y - p0.y;
    const a = Math.hypot(vx, vy);
    if (a < 1e-9) return null;
    const end = { x: p0.x + 5 * a * (vx < 0 ? -1 : 1), y: p0.y + 5 * a * (vy < 0 ? -1 : 1) };
    return { start: p0, end, dx: end.x - p0.x, dy: end.y - p0.y };
  }
  const [start, end] = d.style.reverse ? [p1, p0] : [p0, p1];
  return { start, end, dx: end.x - start.x, dy: end.y - start.y };
}

export function gannLevelLines(f: GannFrame, levels: GannLine[]) {
  return levels
    .map((l, i) => ({ l, t: i / 5 }))
    .filter((x) => x.l.visible)
    .map(({ l, t }) => ({ color: l.color, width: l.width, x: f.start.x + t * f.dx, y: f.start.y + t * f.dy }));
}

export function gannFanLines(f: GannFrame, fans: GannRatioLine[]) {
  return fans
    .filter((l) => l.visible)
    .map((l) => {
      const to =
        l.x > l.y
          ? { x: f.end.x, y: f.start.y + (l.y / l.x) * f.dy }
          : { x: f.start.x + (l.x / l.y) * f.dx, y: f.end.y };
      return { color: l.color, width: l.width, from: f.start, to };
    });
}

/** Screen radii of the visible arcs, with the previous visible arc's radius
 *  (0 for the first) for the fill. */
export function gannArcs(f: GannFrame, arcs: GannRatioLine[]) {
  const n = f.dx !== 0 ? f.dy / f.dx : 0;
  const radius = (px: number, py: number) => (n !== 0 ? Math.hypot(px, py / n) : Math.abs(px));
  let prev = 0;
  const out: { color: string; width: number; r: number; prev: number }[] = [];
  for (const a of arcs) {
    if (!a.visible) continue;
    const r = radius((a.x / 5) * f.dx, (a.y / 5) * f.dy);
    out.push({ color: a.color, width: a.width, r, prev });
    prev = r;
  }
  return out;
}

/** SVG paths of one arc: the quarter ellipse stroke and the fill band from
 *  the previous radius (TV draws both inside the box clip). */
export function gannArcPaths(f: GannFrame, r: number, prev: number): { stroke: string; fill: string } {
  const sx = f.dx < 0 ? -1 : 1;
  const sy = f.dy < 0 ? -1 : 1;
  const k = f.dx !== 0 ? Math.abs(f.dy / f.dx) : 1;
  const sweep = sx * sy > 0 ? 1 : 0;
  const { x: cx, y: cy } = f.start;
  const stroke = `M ${cx + sx * r} ${cy} A ${r} ${r * k} 0 0 ${sweep} ${cx} ${cy + sy * r * k}`;
  const inner =
    prev > 0
      ? `L ${cx} ${cy + sy * prev * k} A ${prev} ${prev * k} 0 0 ${1 - sweep} ${cx + sx * prev} ${cy}`
      : `L ${cx} ${cy}`;
  const fill = `M ${cx + sx * prev} ${cy} L ${cx + sx * r} ${cy} A ${r} ${r * k} 0 0 ${sweep} ${cx} ${cy + sy * r * k} ${inner} Z`;
  return { stroke, fill };
}

/** Box rectangle (screen). */
export function gannBox(f: GannFrame) {
  return {
    left: Math.min(f.start.x, f.end.x),
    top: Math.min(f.start.y, f.end.y),
    right: Math.max(f.start.x, f.end.x),
    bottom: Math.max(f.start.y, f.end.y),
  };
}
