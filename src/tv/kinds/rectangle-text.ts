/*
 * Rectangle text (TV line-tool-rectangle pane view), shared by the renderer
 * and the hit test. Horizontal: Left = box from the left edge, Right = box
 * ending at the right edge, Center = centred (TV getTextAlignInBox point, the
 * box keeps the chosen alignment). Vertical (stored value / TV dialog name):
 * `bottom` / "Top" = box above the top edge, `top` / "Bottom" = box below the
 * bottom edge, `middle` / "Inside" = centred, wrapped to the rectangle width
 * less the side padding and cut to its height. Padding fs/3 vertical, fs/3
 * horizontal only inside. Factory 14px, centre / middle.
 */
import type { Drawing } from "../types";
import type { Pt } from "../_shared";
import { tvTextLayout } from "./tv-text";

/** `paneW` = pane width (TV extends to 0 / the pane width). With an extend
 *  flag on the aligned side, the text anchors at the pane edge while the box
 *  is on screen (else at the other rectangle edge); a Left / Right text wider
 *  than the visible part shifts back by the overflow (TV offsetX). */
export function rectangleTextLayout(d: Drawing, pts: Pt[], paneW: number) {
  const [a, b] = pts;
  if (!d.text || !a || !b) return null;
  const s = d.style;
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const bottom = Math.max(a.y, b.y);
  const extL = !!s.extendLeft;
  const extR = !!s.extendRight;
  const vis = (left <= paneW || extL) && (right >= 0 || extR);
  const fs = s.fontSize ?? 14;
  const padV = fs / 3;
  const horz = s.horzLabelsAlign ?? "center";
  const vert = s.vertLabelsAlign ?? "middle";
  const inside = vert === "middle";
  const padH = inside ? padV : 0;
  const x =
    horz === "left"
      ? extL ? (vis ? 0 : right) : left
      : horz === "right"
        ? extR ? (vis ? paneW : left) : right
        : ((extL && vis ? 0 : left) + (extR && vis ? paneW : right)) / 2;
  const input = {
    x,
    y: inside ? (top + bottom) / 2 : vert === "top" ? bottom : top,
    text: d.text,
    fs,
    bold: s.bold,
    italic: s.italic,
    vert,
    horz,
    padV,
    padH,
    wrapWidth: inside ? (extR ? paneW : right) - (extL ? 0 : left) - 2 * padH : undefined,
    maxHeight: inside ? bottom - top : undefined,
  };
  const l = tvTextLayout(input);
  if ((horz === "left" && extL) || (horz === "right" && extR)) {
    const segL = extL ? 0 : Math.max(left, 0);
    const segR = extR ? paneW : Math.min(right, paneW);
    const over = segR - segL - l.box.width;
    if (over < 0) return tvTextLayout({ ...input, offsetX: over });
  }
  return l;
}
