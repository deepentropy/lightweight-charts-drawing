/*
 * Text helpers shared by the scene builders (moved from OpenTrader
 * DrawingsOverlay, port phase 2): text measuring in the chart font, TV
 * number / time formatters, TV text-box labels and the channel / trend line
 * label (geometry + scene items).
 */
import type { Pt } from "../_shared";
import type { DrawingStyle } from "../types";
import { measureTextStyled, type tvTextLayout } from "../kinds/tv-text";
import type { SceneItem } from "./types";

let measureCtx: CanvasRenderingContext2D | null = null;
let bodyFont: string | null = null;
function ctx2d(): CanvasRenderingContext2D | null {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  return measureCtx;
}
/** Width of `text` in the chart (page body) font. */
export function measureText(text: string, fontSize: number): number {
  const c = ctx2d();
  if (!c) return text.length * fontSize * 0.6;
  bodyFont ??= getComputedStyle(document.body).fontFamily;
  c.font = `${fontSize}px ${bodyFont}`;
  return c.measureText(text).width;
}
/** Width of `text` in the bold chart font. */
export function measureTextBold(text: string, fontSize: number): number {
  const c = ctx2d();
  if (!c) return text.length * fontSize * 0.65;
  bodyFont ??= getComputedStyle(document.body).fontFamily;
  c.font = `bold ${fontSize}px ${bodyFont}`;
  return c.measureText(text).width;
}
/** Width of `text` in a given font family. */
export function measureTextFont(text: string, fontSize: number, fontFamily: string): number {
  const c = ctx2d();
  if (!c) return text.length * fontSize * 0.6;
  c.font = `${fontSize}px ${fontFamily}`;
  return c.measureText(text).width;
}

/** Signed number with TV's minus sign (U+2212). */
export function signedFixed(v: number, digits: number): string {
  const t = Math.abs(v).toFixed(digits);
  return v < 0 ? `−${t}` : t;
}

/** TV TimeSpanFormatter: "1d 21h 30m", zero parts omitted. */
export function tvTimeSpan(seconds: number): string {
  const neg = seconds < 0;
  let t = Math.abs(Math.round(seconds));
  const dd = Math.floor(t / 86400);
  t -= dd * 86400;
  const hh = Math.floor(t / 3600);
  t -= hh * 3600;
  const mm = Math.floor(t / 60);
  t -= mm * 60;
  const parts: string[] = [];
  if (dd) parts.push(`${dd.toLocaleString("en-US")}d`);
  if (hh) parts.push(`${hh}h`);
  if (mm) parts.push(`${mm}m`);
  if (t) parts.push(`${t}s`);
  const out = parts.join(" ");
  return neg ? `-${out}` : out;
}

/** TV volume formatter: up to 2 decimals, unit after a narrow no-break
 *  space (U+202F): "519.06 K", "1.5 M", "2 B". */
export function tvVolume(v: number): string {
  const units: [number, string][] = [[1e9, " B"], [1e6, " M"], [1e3, " K"]];
  for (const [div, u] of units) if (Math.abs(v) >= div) return `${Number((v / div).toFixed(2))}${u}`;
  return String(Math.round(v));
}

/** TV needTextExclusionPath: the line runs through the text only when the
 *  text has an odd number of lines and the middle one is not blank. */
export function textCrossesLine(lines: string[]): boolean {
  return lines.length % 2 === 1 && lines[Math.floor(lines.length / 2)].trim() !== "";
}

/** Label text box polygon (TV TextRenderer `_getBox` + `getPolygonPoints`):
 *  widest line + 2·padH wide, lines·lineH + 2·padV high, placed at `u` by the
 *  alignment (Bottom = box above u, Top = below, Middle = centred; Left = box
 *  starts at u, Right = ends at u, Center = centred), rotated by `angle`
 *  (degrees) around u. */
export function labelBoxPolygon(
  u: Pt, angle: number, lines: string[], fs: number, lineH: number, padV: number, padH: number,
  vert: string, horz: string, bold: boolean, italic: boolean,
): Pt[] {
  const bw = Math.max(0, ...lines.map((l) => measureTextStyled(l, fs, bold, italic))) + 2 * padH;
  const bh = lines.length * lineH + 2 * padV;
  const left = horz === "left" ? u.x : horz === "right" ? u.x - bw : u.x - bw / 2;
  const top = vert === "bottom" ? u.y - bh : vert === "top" ? u.y : u.y - bh / 2;
  const a = (angle * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  const rot = (x: number, y: number): Pt => ({ x: (x - u.x) * cos - (y - u.y) * sin + u.x, y: (x - u.x) * sin + (y - u.y) * cos + u.y });
  return [rot(left, top), rot(left + bw, top), rot(left + bw, top + bh), rot(left, top + bh)];
}

/** TV TextRenderer text box as scene items (a rotated group of lines,
 *  centre baseline). */
export function tvTextItems(layout: ReturnType<typeof tvTextLayout>, color: string, bold?: boolean, italic?: boolean): SceneItem {
  return {
    t: "group",
    transform: layout.rotate,
    inert: true,
    items: layout.lines.map((ln, k) => ({
      t: "text" as const,
      x: layout.tx,
      y: layout.y0 + k * layout.lineStep,
      text: ln,
      size: layout.fs,
      anchor: layout.anchor,
      baseline: "central" as const,
      weight: bold ? 700 : 400,
      fontStyle: italic ? ("italic" as const) : ("normal" as const),
      fill: color,
      pre: true,
    })),
  };
}

/** Channel / trend line label geometry (TV line tools with a text on the
 *  line: parallel channel, trend line family): which edge carries it by the
 *  vertical alignment, where along it by the horizontal alignment, rotated
 *  with the edge. */
export function channelLabelGeom(e: Pt, t: Pt, i: Pt, n: Pt, s: DrawingStyle, padHArg?: number) {
  const text = s.text ?? "";
  if (text === "") return null;
  const vert = s.vertLabelsAlign ?? "bottom";
  const horz = s.horzLabelsAlign ?? "left";
  const mid = vert === "middle";
  let l: Pt;
  let r: Pt;
  if (vert === "bottom") [l, r] = e.y < i.y ? [e, t] : [i, n];
  else if (vert === "top") [l, r] = e.y > i.y ? [e, t] : [i, n];
  else [l, r] = [{ x: (e.x + i.x) / 2, y: (e.y + i.y) / 2 }, { x: (t.x + n.x) / 2, y: (t.y + n.y) / 2 }];
  const c = l.x < r.x ? l : r;
  const h = c === l ? r : l;
  const u = horz === "left" ? c : horz === "right" ? h : { x: (c.x + h.x) / 2, y: (c.y + h.y) / 2 };
  const rad = Math.atan((c.y - h.y) / (c.x - h.x));
  const angle = Number.isNaN(rad) ? 0 : (rad * 180) / Math.PI;
  const fs = s.fontSize ?? 14;
  const padV = fs / 3;
  const padH = padHArg ?? (mid ? padV : 0);
  const lines = text.split("\n");
  const lineH = Math.ceil(fs);
  const boxH = lines.length * lineH + 2 * padV;
  const top = vert === "bottom" ? u.y - boxH : vert === "top" ? u.y : u.y - boxH / 2;
  const x = horz === "left" ? u.x + padH : horz === "right" ? u.x - padH : u.x;
  const anchor: "start" | "end" | "middle" = horz === "left" ? "start" : horz === "right" ? "end" : "middle";
  return { u, angle, fs, lines, lineH, top: top + padV, x, anchor, vert, horz, padV, padH };
}

/** The channel / trend line label as scene items (nothing without text). */
export function channelLabelItems(e: Pt, t: Pt, i: Pt, n: Pt, s: DrawingStyle, padH?: number): SceneItem[] {
  const v = channelLabelGeom(e, t, i, n, s, padH);
  if (!v) return [];
  return [
    {
      t: "group",
      transform: `rotate(${v.angle} ${v.u.x} ${v.u.y})`,
      inert: true,
      items: v.lines.map((ln, k) => ({
        t: "text" as const,
        x: v.x,
        y: v.top + k * v.lineH,
        text: ln,
        size: v.fs,
        anchor: v.anchor,
        baseline: "hanging" as const,
        weight: s.bold ? 700 : 400,
        fontStyle: s.italic ? ("italic" as const) : ("normal" as const),
        fill: s.textColor ?? s.color,
        pre: true,
      })),
    },
  ];
}

/** Channel / trend line label box to cut out of the lines: Middle alignment
 *  only; `always` = cut without the odd-line test (TV parallel channel). */
export function channelLabelCutPoly(e: Pt, t: Pt, i: Pt, n: Pt, s: DrawingStyle, padH: number | undefined, always: boolean): Pt[] | null {
  const g = channelLabelGeom(e, t, i, n, s, padH);
  if (!g || g.vert !== "middle") return null;
  if (!always && !textCrossesLine(g.lines)) return null;
  return labelBoxPolygon(g.u, g.angle, g.lines, g.fs, g.lineH, g.padV, g.padH, g.vert, g.horz, !!s.bold, !!s.italic);
}
