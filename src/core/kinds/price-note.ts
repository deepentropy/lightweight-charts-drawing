/*
 * Price note price label (TV line-tool-price-note renderer), shared by the
 * overlay renderer and the hit test: the P0 price in a TV text box at P1,
 * placed by the P0 → P1 angle (TV alignByAngle, degrees, y down): up
 * (−135…−45) centred above, right (−45…45) to the right, down (45…135)
 * centred below, left otherwise to the left. Padding 6 / 8, 12px factory,
 * background + 1px border, radius 4. TV hit-tests the line (3px) and this box.
 */
import type { Drawing } from "../types";
import type { Pt } from "../_shared";
import { tvTextLayout } from "./tv-text";

export function priceNoteLabel(d: Drawing, pts: Pt[], digits: number) {
  const [a, b] = pts;
  const p0 = d.points[0];
  if (!a || !b || !p0) return null;
  const deg = Math.round((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
  const [horz, vert] =
    deg >= -135 && deg <= -45
      ? (["center", "bottom"] as const)
      : deg > -45 && deg < 45
        ? (["left", "middle"] as const)
        : deg >= 45 && deg <= 135
          ? (["center", "top"] as const)
          : (["right", "middle"] as const);
  const s = d.style;
  return tvTextLayout({
    x: b.x,
    y: b.y,
    text: p0.price.toFixed(digits),
    fs: s.priceLabelFontSize ?? 12,
    bold: s.priceLabelBold,
    italic: s.priceLabelItalic,
    horz,
    vert,
    padV: 6,
    padH: 8,
  });
}
