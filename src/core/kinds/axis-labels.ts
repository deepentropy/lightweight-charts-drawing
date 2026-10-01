/*
 * Axis labels of a drawing (port phase 3; the rules of OpenTrader's overlay:
 * renderAxisParts + the price-line sync):
 *   - vertical / cross line with Show time: its time on the time axis, in the
 *     line colour (TV showTime);
 *   - long / short position (Price labels on by default): the entry, target
 *     and stop prices on the price axis (grey, green, red);
 *   - any other tool with Price labels: the price of each point, in the
 *     line colour (a vertical line has none);
 *   - anchored VWAP (Price label on by default): the VWAP's last value.
 * Text colour: black on a light label, white otherwise (textOnColor).
 */
import type { Time } from "lightweight-charts";
import type { Pt } from "../_shared";
import type { Coords } from "../coords";
import type { Drawing } from "../types";
import { parseColor, textOnColor } from "../color";
import { positionAnchors } from "./position";
import { vwapLastValue } from "./data-series";

export type PriceAxisLabel = { price: number; back: string; color: string };
export type TimeAxisLabel = { time: Time; back: string; color: string };

const label = <T extends object>(v: T, back: string) => ({ ...v, back, color: textOnColor(back) });

export function drawingAxisLabels(d: Drawing, pts: Pt[], coords: Coords): { price: PriceAxisLabel[]; time: TimeAxisLabel[] } {
  const s = d.style;
  const price: PriceAxisLabel[] = [];
  const time: TimeAxisLabel[] = [];
  if (d.kind === "vertical-line" || d.kind === "cross-line") {
    if (s.showTime && d.points[0]) time.push(label({ time: d.points[0].time }, parseColor(s.color).hex));
  }
  if (d.kind === "long-position" || d.kind === "short-position") {
    if (s.showPriceLabels !== false) {
      const pa = positionAnchors(d, pts, coords);
      if (pa) {
        const entry = d.points[0].price;
        const sign = d.kind === "long-position" ? 1 : -1;
        price.push(label({ price: entry }, "#787b86"), label({ price: entry + sign * pa.profit }, "#089981"), label({ price: entry - sign * pa.stop }, "#f23645"));
      }
    }
    return { price, time };
  }
  if (d.kind === "anchored-vwap") {
    if (s.vwapPriceLabel !== false) {
      const v = vwapLastValue(d, coords);
      if (v != null) price.push(label({ price: v }, parseColor(s.color).hex));
    }
    return { price, time };
  }
  if (s.showPriceLabels && d.kind !== "vertical-line") {
    for (const p of d.points) price.push(label({ price: p.price }, parseColor(s.color).hex));
  }
  return { price, time };
}
