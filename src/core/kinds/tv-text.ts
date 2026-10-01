/*
 * TV TextRenderer layout (module 470986), shared by the overlay renderers and
 * the hit tests. Pure TS (a canvas 2D context measures the text).
 */
import type { Pt } from "../_shared";

let ctx: CanvasRenderingContext2D | null = null;
let bodyFontFamily: string | null = null;
/** Width of `text` in the chart font with bold / italic (label boxes). */
export function measureTextStyled(text: string, fontSize: number, bold: boolean, italic: boolean): number {
  if (!ctx) ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return text.length * fontSize * 0.6;
  bodyFontFamily ??= getComputedStyle(document.body).fontFamily;
  ctx.font = `${italic ? "italic " : ""}${bold ? "bold " : ""}${fontSize}px ${bodyFontFamily}`;
  return ctx.measureText(text).width;
}

/** TV TextRenderer layout (module 470986, `_getBoxSize` / `_getBox` /
 *  `_getRotationPoint` / `_getInternalData`): box = widest line + left and
 *  right padding (rounded, made even) by lines·fs + 2·padV (no line spacing);
 *  placed at the point by the alignment and offsets (Bottom: box above,
 *  Top: below, Left: box starts offsetX right of the point, Right: ends
 *  offsetX left of it); text x at the padded left / centre / right, first
 *  line centre = box top + padV + fs/2 (+0.05·fs); rotated by `angle`
 *  (radians) around the aligned box corner / edge. Padding default fs/3. */
/** TV wordWrap (module 691695) with hidden parts dropped (TextRenderer
 *  keeps only the visible lines): each text line wider than `width` breaks
 *  at spaces; a word longer than the width is cut by characters (the longest
 *  prefix that fits, at least one character); spaces overflowing a line end
 *  are hidden. No wrap when the width is not positive or narrower than "x". */
export function tvWordWrap(text: string, fs: number, bold: boolean, italic: boolean, width?: number): string[] {
  const lines = text.split(/\r\n|\r|\n/);
  if (width == null || !Number.isFinite(width) || width <= 0) return lines;
  const m = (t: string) => measureTextStyled(t, fs, bold, italic);
  if (m("x") > width) return lines;
  const chunks = (t: string): string[] => {
    const out: string[] = [];
    while (t.length) {
      // first prefix length whose width exceeds the limit (upper bound)
      let lo = 0, hi = t.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (m(t.slice(0, mid + 1)) > width) hi = mid;
        else lo = mid + 1;
      }
      const h = Math.max(1, lo);
      out.push(t.slice(0, h));
      t = t.slice(h);
    }
    return out;
  };
  const out: string[] = [];
  for (const line of lines) {
    if (m(line) <= width) {
      out.push(line);
      continue;
    }
    const words: { word: string; spaces: string }[] = [];
    let rest = line;
    do {
      const sp = rest.match(/\s+/);
      if (!sp || sp.index === undefined) {
        words.push({ word: rest, spaces: "" });
        break;
      }
      words.push({ word: rest.slice(0, sp.index), spaces: sp[0] });
      rest = rest.slice(sp.index + sp[0].length);
    } while (rest.length);
    let g = "";
    let f = 0;
    while (f < words.length) {
      const w = words[f];
      let t = `${g}${w.word}`;
      if (m(t) > width) {
        if (g !== "") {
          out.push(g);
          g = "";
        } else if (t.length === 1) {
          out.push(t);
          w.word = "";
        } else {
          const c = chunks(t);
          for (let k = 0; k < c.length - 1; k++) out.push(c[k]);
          w.word = c[c.length - 1];
        }
        continue;
      }
      t = `${g}${w.word}${w.spaces}`;
      if (m(t) < width) {
        g = t;
        f += 1;
        continue;
      }
      out.push(chunks(t)[0]);
      g = "";
      f += 1;
    }
    if (g !== "") out.push(g);
  }
  return out;
}

export type TvTextInput = {
  x: number;
  y: number;
  text: string;
  fs: number;
  bold?: boolean;
  italic?: boolean;
  vert: "top" | "middle" | "bottom";
  horz: "left" | "center" | "right";
  offsetX?: number;
  offsetY?: number;
  angle?: number;
  padV?: number;
  padH?: number;
  /** TV wordWrapWidth / maxHeight (lines kept: floor(maxHeight / fs)). */
  wrapWidth?: number;
  maxHeight?: number;
  /** TV TextRenderer `_getLinesMaxWidth`: with a wrap width (and no
   *  forceCalculateMaxLineWidth) the box is the wrap width wide. */
  boxWidthFromWrap?: boolean;
  /** TV lineSpacing (px between lines, default 0). */
  lineSpacing?: number;
};
export function tvTextLayout(d: TvTextInput) {
  const fs = d.fs;
  let lines = d.wrapWidth != null ? tvWordWrap(d.text, fs, !!d.bold, !!d.italic, d.wrapWidth) : d.text.split("\n");
  if (d.maxHeight != null) lines = lines.slice(0, Math.max(0, Math.floor(d.maxHeight / fs)));
  const padV = d.padV ?? fs / 3;
  const padH = d.padH ?? fs / 3;
  const ox = d.offsetX ?? 0;
  const oy = d.offsetY ?? 0;
  const textW = d.boxWidthFromWrap && d.wrapWidth != null ? d.wrapWidth : Math.max(0, ...lines.map((l) => measureTextStyled(l, fs, !!d.bold, !!d.italic)));
  let bw = Math.round(textW + 2 * padH);
  if (bw % 2) bw += 1;
  const ls = d.lineSpacing ?? 0;
  const bh = fs * lines.length + ls * Math.max(0, lines.length - 1) + 2 * padV;
  const top = d.vert === "bottom" ? d.y - bh - oy : d.vert === "middle" ? d.y - bh / 2 : d.y + oy;
  const left = d.horz === "left" ? d.x + ox : d.horz === "center" ? d.x - bw / 2 : d.x - bw - ox;
  const rx = d.horz === "center" ? left + bw / 2 : d.horz === "left" ? left : left + bw;
  const ry = d.vert === "middle" ? top + bh / 2 : d.vert === "top" ? top : top + bh;
  const tx = d.horz === "left" ? left + padH : d.horz === "right" ? left + bw - padH : left + bw / 2;
  const anchor: "start" | "middle" | "end" = d.horz === "left" ? "start" : d.horz === "right" ? "end" : "middle";
  const a = d.angle ?? 0;
  const cos = Math.cos(a), sin = Math.sin(a);
  const rot = (x: number, y: number): Pt => ({ x: (x - rx) * cos - (y - ry) * sin + rx, y: (x - rx) * sin + (y - ry) * cos + ry });
  return {
    lines,
    fs,
    /** Distance between two line centres (fs + lineSpacing). */
    lineStep: fs + ls,
    tx,
    y0: top + padV + fs / 2 + 0.05 * fs,
    anchor,
    rotate: `rotate(${(a * 180) / Math.PI} ${rx} ${ry})`,
    box: { left, top, width: bw, height: bh },
    poly: [rot(left, top), rot(left + bw, top), rot(left + bw, top + bh), rot(left, top + bh)],
  };
}

