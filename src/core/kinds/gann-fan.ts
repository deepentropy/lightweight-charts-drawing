/*
 * Gann fan geometry, shared by the scene (scene/gann.ts) and the hit test
 * (kinds/hit-tests.ts).
 */
import type { Pt } from "../_shared";

/** Gann-fan ray direction for a level: coeff scales the time leg of the 1/1
 *  anchor move ("1/8" reaches the full dy in an eighth of the dt, the
 *  steepest ray; "8/1" the shallowest). */
export function gannFanDir(a: Pt, b: Pt, coeff: number): Pt {
  const dx = b.x - a.x || 1;
  const dy = b.y - a.y;
  return { x: dx * coeff, y: dy };
}
