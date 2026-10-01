/*
 * Pitchfork family geometry (moved from OpenTrader DrawingsOverlay), shared by
 * the scene (scene/gann.ts) and the hit test (kinds/hit-tests.ts).
 */
import type { Pt } from "../_shared";

/** Pitchfork family geometry (TV): pivot and median direction per variant.
 *  Original: median from P0 through mid(P1,P2). Schiff: median base
 *  (P0.x, (P0.y + P1.y) / 2). Modified Schiff: base mid(P0, P1). Inside:
 *  median from mid(P1,P2) along (P2 − mid(P0,P1)). Level lines are parallel
 *  to the median at ±coeff·(P2−P1)/2 from mid(P1,P2). */
export function pitchforkGeom(kind: string, pts: Pt[]): { pivot: Pt; dir: Pt; t1: Pt; t2: Pt; mid: Pt; half: Pt } | null {
  const [p1, p2, p3] = pts;
  const mid = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };
  const half = { x: (p3.x - p2.x) / 2, y: (p3.y - p2.y) / 2 };
  let pivot: Pt = p1;
  let dir: Pt;
  if (kind === "schiff-pitchfork") {
    pivot = { x: p1.x, y: (p1.y + p2.y) / 2 };
    dir = { x: mid.x - pivot.x, y: mid.y - pivot.y };
  } else if (kind === "modified-schiff-pitchfork") {
    pivot = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    dir = { x: mid.x - pivot.x, y: mid.y - pivot.y };
  } else if (kind === "inside-pitchfork") {
    const m01 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    pivot = mid;
    dir = { x: p3.x - m01.x, y: p3.y - m01.y };
  } else {
    dir = { x: mid.x - pivot.x, y: mid.y - pivot.y };
  }
  if (Math.hypot(dir.x, dir.y) < 1e-6) return null;
  return { pivot, dir, t1: p2, t2: p3, mid, half };
}

/** A ray from `origin` along `dir` to the right pane edge; collapses to the
 *  origin when the direction has no rightward component. */
export function pitchforkExtendRight(origin: Pt, dir: Pt, width: number): Pt {
  if (dir.x <= 0) return origin;
  const t = (width - origin.x) / dir.x;
  return { x: width, y: origin.y + dir.y * t };
}
