/*
 * Arrow mark text box (TV line-tool-arrow-mark text renderer, module
 * 501042 + TextRenderer 385034), shared by the renderer and the hit test.
 * Box = the widest line + 2 · padding (fs / 3), rounded up to an even width;
 * height = lines · ceil(fs) + 2 · padding; centred on the point, its top 20px
 * below an up arrow, its bottom 20px above a down arrow. TV hit-tests the
 * text inside this box.
 */
import type { Drawing } from "../types";
import type { Pt } from "../_shared";

let ctx: CanvasRenderingContext2D | null = null;
function textWidth(text: string, font: string): number {
  if (!ctx) ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return text.length * 8;
  ctx.font = font;
  return ctx.measureText(text).width;
}

export type ArrowMarkTextBox = { left: number; top: number; width: number; height: number; lines: string[]; lineH: number; pad: number };

export function arrowMarkTextBox(d: Drawing, c: Pt): ArrowMarkTextBox | null {
  const text = d.text ?? "";
  if (text === "" || (d.kind !== "arrow-mark-up" && d.kind !== "arrow-mark-down")) return null;
  const s = d.style;
  const fs = s.fontSize ?? 14;
  const pad = fs / 3;
  const lineH = Math.ceil(fs);
  const lines = text.split("\n");
  const font = `${s.italic ? "italic " : ""}${s.bold ? "bold " : ""}${fs}px ${getComputedStyle(document.body).fontFamily}`;
  let width = Math.round(Math.max(...lines.map((l) => textWidth(l, font))) + 2 * pad);
  if (width % 2) width += 1;
  const height = lines.length * lineH + 2 * pad;
  const top = d.kind === "arrow-mark-up" ? c.y + 20 : c.y - 20 - height;
  return { left: c.x - width / 2, top, width, height, lines, lineH, pad };
}
