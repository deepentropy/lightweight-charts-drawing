/*
 * TV signpost (LineToolSignpost, module 28577 LineToolWithRelativePriceCoordinate
 * + line-tool-signpost). The drawing is tied to a bar: the pole starts 3px
 * off the bar's high (label above) or low (label below) and the label sits at
 * `position` percent of the distance from that bar to the pane edge (signed:
 * + above, - below; factory 50). Pure TS geometry for the renderer and the
 * hit test.
 */
import type { Coords } from "../coords";
import type { DataPoint, Drawing } from "../types";
import type { Pt } from "../_shared";
import { tvTextLayout } from "./tv-text";
import { toolText } from "./text-tools";

/** TV theme colours (dark): pole cold-gray-500, label cold-gray-900 with a
 *  cold-gray-800 border and cold-gray-200 text, plate border cold-gray-900. */
export const SIGNPOST_COLORS = { pole: "#808080", labelBg: "#0f0f0f", labelBorder: "#2e2e2e", labelText: "#dbdbdb", plateBorder: "#0f0f0f" };

function barPrices(coords: Coords, p: DataPoint): { high: number; low: number } | null {
  const b = coords.barAt(p.time);
  return b ? { high: b.high, low: b.low } : null;
}

/** TV `_updatePositionAndCorrectPoint`: the signed position (%) for a point
 *  whose price is the label height. */
export function signpostPositionFor(coords: Coords, p: DataPoint, paneH: number): number {
  const bar = barPrices(coords, p);
  const y = coords.priceToY(p.price);
  if (y == null) return 50;
  let n = 1;
  let barY = paneH / 2;
  if (bar) {
    n = p.price >= bar.low ? 1 : -1;
    barY = coords.priceToY(n === 1 ? bar.high : bar.low) ?? barY;
  } else {
    n = y <= paneH / 2 ? 1 : -1;
  }
  const avail = n === 1 ? barY : paneH - barY;
  const f = Math.min(paneH, Math.abs(y - barY));
  return avail > 0 ? Math.max(0, Math.min(100, (100 * f) / avail)) * n : 50 * n;
}

/** Label y for a signed position (TV positionToCoordinate). */
function labelYFor(pos: number, paneH: number, barY: number, n: number): number {
  const i = Math.min(paneH, Math.max(0, n === 1 ? barY : paneH - barY));
  return barY - n * Math.abs((i * pos) / 100);
}

export function signpostLayout(d: Drawing, p: Pt, coords: Coords, paneH: number) {
  const s = d.style;
  const pos = s.signpostPosition ?? 50;
  const n = pos >= 0 ? 1 : -1;
  const bar = barPrices(coords, d.points[0]);
  const barYraw = bar ? coords.priceToY(n === 1 ? bar.high : bar.low) : null;
  // No bar (off data, TV getNoDataPosition): the pole starts at the pane
  // bottom and the label is measured from the middle.
  const onData = barYraw != null;
  const barY = onData ? barYraw! : paneH / 2;
  const poleStart = onData ? barY - n * 3 : paneH;
  const fs = s.fontSize ?? 12;
  const make = (y: number) =>
    tvTextLayout({
      x: p.x,
      y,
      text: toolText(d).text,
      fs,
      bold: s.bold,
      italic: s.italic,
      vert: n === 1 ? "top" : "bottom",
      horz: "center",
      padV: 6,
      padH: 8,
      wrapWidth: 134,
      lineSpacing: 3,
    });
  let y = labelYFor(pos, paneH, barY, n);
  let l = make(y);
  const lh = l.box.height;
  const clamped = n === 1 ? Math.min(poleStart - lh, y) : Math.max(poleStart + lh, y);
  if (clamped !== y) {
    y = clamped;
    l = make(y);
  }
  const plate = s.showImage ? 80 : 0;
  // pole: bar -> the label side facing the bar (+ the plate when shown)
  const poleEnd = y + (lh + plate) * n;
  const plateY = y + (lh + 10 + 35) * n;
  const gap: [number, number] | null = s.showImage ? [y + lh * n, y + lh * n + 10 * n] : null;
  return { l, anchor: { x: p.x, y }, poleStart, poleEnd, plateY, gap, n, x: p.x };
}

/** The signed position for a label anchor dragged to screen y (TV setPoint
 *  keeps the bar). */
export function signpostPositionAtY(d: Drawing, coords: Coords, paneH: number, y: number): number | null {
  const price = coords.yToPrice(y);
  return price == null ? null : signpostPositionFor(coords, { time: d.points[0].time, price }, paneH);
}
