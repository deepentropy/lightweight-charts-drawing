/*
 * TV fib level labels (module 445750 LineToolPaneViewFibWithLabels
 * `_updateLabelForLevel` / `_updateRendererLabel` + TextRenderer
 * getTextAlignInBox): the coefficient (number, or percent with 2 decimals)
 * and / or " (price)", in a text box 4px from the level's end chosen by the
 * horizontal alignment; font = labelFontSize (factory 12).
 */
import { tvTextLayout } from "./tv-text";

/** Level value text (TV numeric / percentage formatter). */
export function fibCoeffText(coeff: number, percents: boolean): string {
  if (percents) return `${(100 * coeff).toFixed(2)}%`;
  return String(Math.round(coeff * 1e4) / 1e4);
}

/** Label of a horizontal level from `left` to `right` at `y`. TV Left = the
 *  box ends 4px before the left end (with extend left: starts 4px after the
 *  pane's left edge), Right = starts 4px after the right end (extend right:
 *  ends 4px before the pane edge), Center = the middle of the drawn span. */
export function fibLevelLabel(o: {
  text: string;
  y: number;
  left: number;
  right: number;
  extendLeft: boolean;
  extendRight: boolean;
  paneW: number;
  horz: "left" | "center" | "right";
  vert: "top" | "middle" | "bottom";
  fs: number;
}) {
  if (!o.text) return null;
  let x: number;
  let horz: "left" | "center" | "right";
  if (o.horz === "left") {
    x = o.extendLeft ? 0 : o.left;
    horz = o.extendLeft ? "left" : "right";
  } else if (o.horz === "right") {
    x = o.extendRight ? o.paneW : o.right;
    horz = o.extendRight ? "right" : "left";
  } else {
    x = ((o.extendLeft ? 0 : o.left) + (o.extendRight ? o.paneW : o.right)) / 2;
    horz = "center";
  }
  return tvTextLayout({ x, y: o.y, text: o.text, fs: o.fs, vert: o.vert, horz, offsetX: 4 });
}
