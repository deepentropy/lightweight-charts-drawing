/*
 * TV text tool geometry (pure TS), shared by the overlay renderers and the
 * hit tests. Sources: TV bundles line-tool-text, line-tool-comment,
 * line-tool-note (pin), line-tool-price-label, line-tool-callout (research
 * copies in .tmp/tv-bundles, 10/07/2026; checked against TV 3.4.1 screenshots
 * 25/09/2026, research/drawings-gap/captures/dialog-fix).
 */
import type { Drawing } from "../types";
import type { Pt } from "../_shared";
import { measureTextStyled, tvTextLayout, tvWordWrap } from "./tv-text";

/** TV placeholder of an empty text tool ("Add text", drawn at 50%). */
export const TEXT_TOOL_PLACEHOLDER = "Add text";
export function toolText(d: Drawing): { text: string; faint: boolean } {
  return d.text ? { text: d.text, faint: false } : { text: TEXT_TOOL_PLACEHOLDER, faint: true };
}

/** TV text (LineToolText): TextRenderer box with its top-left at the point,
 *  padding fs / 6, word wrap at wordWrapWidth (box = wrap width wide). */
export function textToolLayout(d: Drawing, p: Pt) {
  const s = d.style;
  const fs = s.fontSize ?? 14;
  const pad = fs / 6;
  return tvTextLayout({
    x: p.x,
    y: p.y,
    text: toolText(d).text,
    fs,
    bold: s.bold,
    italic: s.italic,
    vert: "top",
    horz: "left",
    padV: pad,
    padH: pad,
    wrapWidth: s.wordWrap ? s.wordWrapWidth ?? 200 : undefined,
    boxWidthFromWrap: true,
  });
}

/** TV comment: text box above-right of the point (vert Bottom, horz Left),
 *  padding round(fs / 1.3) x 12; the balloon is that box as a rounded rect
 *  with radius min(width, fs + 2 padV) / 2 and a 2px corner at the point. */
export function commentLayout(d: Drawing, p: Pt) {
  const s = d.style;
  const fs = s.fontSize ?? 16;
  const padV = Math.round(fs / 1.3);
  const l = tvTextLayout({ x: p.x, y: p.y, text: toolText(d).text, fs, vert: "bottom", horz: "left", padV, padH: 12 });
  const r = Math.min(l.box.width, fs + 2 * padV) / 2;
  return { l, r };
}
/** SVG path of a rounded rect with corner radii [tl, tr, br, bl]. */
export function roundRectPath(x: number, y: number, w: number, h: number, [tl, tr, br, bl]: [number, number, number, number]): string {
  return `M ${x + tl} ${y} H ${x + w - tr} A ${tr} ${tr} 0 0 1 ${x + w} ${y + tr} V ${y + h - br} A ${br} ${br} 0 0 1 ${x + w - br} ${y + h} H ${x + bl} A ${bl} ${bl} 0 0 1 ${x} ${y + h - bl} V ${y + tl} A ${tl} ${tl} 0 0 1 ${x + tl} ${y} Z`;
}

/** TV pin marker (24 x 30 svg, tip at the point). */
export const PIN_MARKER_PATH = "m12 30 .88-.77C20.25 22.73 24 17.07 24 12.09 24 5.04 18.54 0 12 0S0 5.04 0 12.1c0 4.97 3.75 10.64 11.12 17.13L12 30Zm0-13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z";
/** TV pin tooltip (shown on hover / selection): 236px wide (pane width at
 *  most) with 10px margins, 12px padding, 5px line spacing, 13px from the
 *  marker; above the marker with the caret at the bottom, else below with
 *  the caret on top; no caret within 24px of a pane side. */
export function pinLayout(d: Drawing, p: Pt, paneW: number) {
  const s = d.style;
  const fs = s.fontSize ?? 14;
  const width = Math.min(236, paneW);
  const lines = tvWordWrap(toolText(d).text, fs, !!s.bold, !!s.italic, width - 24);
  let height = lines.length * fs + 24;
  if (lines.length > 1) height += 5 * (lines.length - 1);
  let left = Math.round(p.x - width / 2);
  let top = Math.round(p.y - 30 - height - 13);
  const edge = p.x < 24 || p.x + 24 > paneW;
  let caret: "top" | "bottom" | null = edge ? null : "top";
  if (top < 10) top = p.y + 13;
  else if (!edge) caret = "bottom";
  if (left < 10) left = 10;
  else if (left + width + 10 > paneW) left = paneW - width - 10;
  return { fs, width, height, left, top, lines, caret, marker: { left: p.x - 12, top: p.y - 30, right: p.x + 12, bottom: p.y } };
}
/** Tooltip outline (TV `z`): radius 4 box with a 12 x 10 caret at the
 *  marker x on the side facing the marker. */
export function pinTooltipPath(t: ReturnType<typeof pinLayout>, x: number): string {
  const { left: l, top: tp, width: w, height: h, caret } = t;
  const r = 4;
  const c0 = x - 6, c1 = x + 6;
  let d = `M ${l} ${tp + r} A ${r} ${r} 0 0 1 ${l + r} ${tp}`;
  if (caret === "top") d += ` L ${c0} ${tp} L ${x} ${tp - 10} L ${c1} ${tp}`;
  d += ` L ${l + w - r} ${tp} A ${r} ${r} 0 0 1 ${l + w} ${tp + r} L ${l + w} ${tp + h - r} A ${r} ${r} 0 0 1 ${l + w - r} ${tp + h}`;
  if (caret === "bottom") d += ` L ${c1} ${tp + h} L ${x} ${tp + h + 10} L ${c0} ${tp + h}`;
  d += ` L ${l + r} ${tp + h} A ${r} ${r} 0 0 1 ${l} ${tp + h - r} Z`;
  return d;
}

/** TV price label: box (text + 20) x (fs + 10), bottom-left 9px right of
 *  and 15px above the point, tail from the box to the point. */
export function priceLabelLayout(label: string, p: Pt, fs: number) {
  const w = measureTextStyled(label, fs, true, false) + 20;
  const h = fs + 10;
  const x = p.x + 9;
  const y = p.y - (h + 15);
  return { x, y, w, h, fs };
}
export function priceLabelPath(b: ReturnType<typeof priceLabelLayout>): string {
  const { x, y, w, h } = b;
  const r = 3;
  return `M ${x + 12} ${y + h} L ${x - 9} ${y + h + 15} L ${x + 5} ${y + h} L ${x + r} ${y + h} A ${r} ${r} 0 0 1 ${x} ${y + h - r} L ${x} ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} L ${x + w - r} ${y} A ${r} ${r} 0 0 1 ${x + w} ${y + r} L ${x + w} ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} Z`;
}

/** TV callout: box centred at p1, (text width + 20) x (fs x lines + 20),
 *  corner radius 8, the pointer to p0 drawn from the side / corner region
 *  p0 is in (TV `_drawImpl`), text lines from the top-left + 10. */
export function calloutLayout(d: Drawing, p1: Pt) {
  const s = d.style;
  const fs = s.fontSize ?? 14;
  const wrap = s.wordWrap ? s.wordWrapWidth ?? 200 : undefined;
  const lines = tvWordWrap(toolText(d).text, fs, !!s.bold, !!s.italic, wrap);
  const textW = wrap ?? Math.max(0, ...lines.map((l) => measureTextStyled(l, fs, !!s.bold, !!s.italic)));
  const textH = fs * lines.length;
  const w = textW + 20;
  const h = textH + 20;
  const x = p1.x - w / 2;
  const y = p1.y - h / 2;
  return { fs, lines, textW, textH, x, y, w, h, wrap };
}
export function calloutPath(c: ReturnType<typeof calloutLayout>, p0: Pt, p1: Pt): string {
  const { x: s, y: d, w: a, h: l, textW: n, textH: r } = c;
  const ex = p0.x - s, ey = p0.y - d;
  const ix = p1.x - s, iy = p1.y - d;
  let code = 0;
  if (p0.x > s + a) code = 20;
  else if (p0.x > s) code = 10;
  if (p0.y > d + l) code += 2;
  else if (p0.y > d) code += 1;
  const u = n + 4 > 16;
  const pv = r + 4 > 16;
  const P = (px: number, py: number) => `${s + px} ${d + py}`;
  const arc = (tx: number, ty: number) => `A 8 8 0 0 1 ${P(tx, ty)}`;
  let path = `M ${P(8, 0)}`;
  if (code === 10) path += u ? ` L ${P(ix - 8, 0)} L ${P(ex, ey)} L ${P(ix + 8, 0)} L ${P(a - 8, 0)}` : ` L ${P(ex, ey)} L ${P(a - 8, 0)}`;
  else path += ` L ${P(a - 8, 0)}`;
  path += code === 20 ? ` L ${P(ex, ey)} L ${P(a, 8)}` : ` ${arc(a, 8)}`;
  if (code === 21) path += pv ? ` L ${P(a, iy - 8)} L ${P(ex, ey)} L ${P(a, iy + 8)} L ${P(a, l - 8)}` : ` L ${P(ex, ey)} L ${P(a, l - 8)}`;
  else path += ` L ${P(a, l - 8)}`;
  path += code === 22 ? ` L ${P(ex, ey)} L ${P(a - 8, l)}` : ` ${arc(a - 8, l)}`;
  if (code === 12) path += u ? ` L ${P(ix + 8, l)} L ${P(ex, ey)} L ${P(ix - 8, l)} L ${P(8, l)}` : ` L ${P(ex, ey)} L ${P(8, l)}`;
  else path += ` L ${P(8, l)}`;
  path += code === 2 ? ` L ${P(ex, ey)} L ${P(0, l - 8)}` : ` ${arc(0, l - 8)}`;
  if (code === 1) path += pv ? ` L ${P(0, iy + 8)} L ${P(ex, ey)} L ${P(0, iy - 8)} L ${P(0, 8)}` : ` L ${P(ex, ey)} L ${P(0, 8)}`;
  else path += ` L ${P(0, 8)}`;
  path += code === 0 ? ` L ${P(ex, ey)} L ${P(8, 0)}` : ` ${arc(8, 0)}`;
  return path + " Z";
}
