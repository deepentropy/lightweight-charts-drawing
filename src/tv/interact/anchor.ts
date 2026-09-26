/*
 * TV "Anchor drawing" (floating toolbar button toggle-anchor, action
 * Chart.SelectedObject.ToggleAnchored; property `anchored`): an anchored
 * drawing keeps a fixed position on the pane (pane fractions) instead of a
 * time / price point. Anchorable tools in TradingView (anchorable() true):
 * Text, Pin (TV LineToolNote), Table. TradingView's retired "Anchored text"
 * tool was the Text tool with this on by default (OpenTrader
 * research/anchored-text, 26/09/2026). Moved from OpenTrader DrawingsOverlay
 * toggleAnchored (table only until then).
 */
import type { Coords } from "../coords";
import type { Drawing } from "../types";
import { projectPoint, replaceDrawingPoints } from "./project";
import { floorTimeAt } from "./drag";

export const ANCHORABLE_KINDS = new Set<string>(["text", "pin", "table"]);

export function isAnchorable(kind: string): boolean {
  return ANCHORABLE_KINDS.has(kind);
}

/** TV _onAnchoredChange: anchoring stores the current screen point as pane
 *  fractions; unanchoring turns the fixed point back into a data point (bar
 *  at or left of it, as TV setPoint). Null when not anchorable / not
 *  projectable. */
export function toggleAnchored(d: Drawing, coords: Coords, pane: { w: number; h: number }): Drawing | null {
  if (!isAnchorable(d.kind) || pane.w <= 0 || pane.h <= 0) return null;
  if (!d.anchored) {
    const p = projectPoint(coords, d.points[0]);
    return p ? ({ ...d, anchored: { x: p.x / pane.w, y: p.y / pane.h } } as Drawing) : null;
  }
  const x = d.anchored.x * pane.w;
  const y = d.anchored.y * pane.h;
  const time = floorTimeAt(coords, x);
  const price = coords.yToPrice(y);
  if (time == null || price == null) return null;
  const { anchored: _a, ...rest } = d;
  return replaceDrawingPoints(rest as Drawing, [{ time, price }]);
}
