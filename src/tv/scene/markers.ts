/*
 * Markers and candle replicas as scenes (moved from OpenTrader
 * DrawingsOverlay, port phase 2): arrow marker, arrow mark up / down, flag
 * mark, price label, font icon, bars pattern, ghost feed.
 */
import { bboxCorners, HANDLE_RADIUS, HIT_TOLERANCE, strokeTolerance, timeToSec, type Pt } from "../_shared";
import type { Coords } from "../coords";
import type { Drawing, DrawingStyle } from "../types";
import { GHOST_CANDLE_DEFAULTS } from "../specs";
import { arrowMarkTextBox } from "../kinds/arrow-mark";
import { barsPatternGeometry } from "../kinds/bars-pattern";
import { priceLabelLayout, priceLabelPath } from "../kinds/text-tools";
import { applyOpacity, parseColor } from "../color";
import type { Scene, SceneItem } from "./types";

/* ---------- arrow marker (2-point; LineToolArrowMarker) ----------
 * TV geometry (line-tool-arrow-marker chunk): a filled arrow whose OUTLINE
 * tapers from a point at the tail (p0) to a swept head at p1. The head length
 * scales with the segment: 18px under a 92px threshold, else clamp(0.25·len,
 * 18…106, ≤0.9·len); the outline stroke scales clamp(round(0.02·len), 2…5).
 * Segments shorter than 22px draw at the 22px minimum (tail pushed back), and
 * a degenerate zero-length marker draws as a 9px dot. Optional style text
 * anchors at the tail, placed opposite the arrow direction. */
function arrowMarkerHeadLen(len: number): number {
  if (len < 92) return 18;
  return Math.min(Math.max(len * 0.25, 18), 106, len * 0.9);
}

export function sceneArrowMarker(pts: Pt[], selected: boolean, s: DrawingStyle): Scene {
  const [a0, b] = pts;
  const rawLen = Math.hypot(b.x - a0.x, b.y - a0.y);
  const fs = s.fontSize ?? 16;
  const textItems = (x: number, y: number, anchor: "start" | "middle" | "end"): SceneItem[] =>
    s.text
      ? [{
          t: "text", x, y, text: s.text, anchor, size: fs, weight: s.bold !== false ? 700 : 400,
          fontStyle: s.italic ? "italic" : "normal", fill: s.textColor ?? s.color, inert: true,
        }]
      : [];
  // Degenerate marker (both clicks on the same spot): TV draws a 9px circle.
  if (rawLen < 1) {
    const out: Scene = [{ t: "circle", cx: b.x, cy: b.y, r: 9, fill: s.color }, ...textItems(b.x + 12, b.y + fs * 0.35, "start")];
    if (selected) out.push({ t: "anchors", pts: [b] });
    return out;
  }
  // Enforce TV's 22px minimum drawable length (tail pushed back behind p1).
  let a = a0;
  if (rawLen < 22) {
    const u = { x: (b.x - a0.x) / rawLen, y: (b.y - a0.y) / rawLen };
    a = { x: b.x - u.x * 22, y: b.y - u.y * 22 };
  }
  const dxv = b.x - a.x;
  const dyv = b.y - a.y;
  const len = Math.hypot(dxv, dyv);
  const ux = dxv / len;
  const uy = dyv / len;
  const px = -uy;
  const py = ux;
  const head = arrowMarkerHeadLen(len);
  const backStep = len >= 35 ? 0.1 : 0;
  // Half-profile (x along the shaft, y across): tail point → shaft flare →
  // head base → tip; mirrored across the axis for the full outline.
  const profile: Pt[] = [
    { x: 0, y: 0 },
    { x: len - head + head * backStep, y: (1.22 * head) / 4 },
    { x: len - head, y: (1.22 * head) / 2 },
    { x: len, y: 0 },
  ];
  const at = (o: Pt, side: 1 | -1): Pt => ({ x: a.x + ux * o.x + px * o.y * side, y: a.y + uy * o.x + py * o.y * side });
  const outline = [
    ...profile.map((o) => at(o, 1)),
    ...profile.slice(0, profile.length - 1).reverse().map((o) => at(o, -1)),
  ];
  const strokeW = Math.min(5, Math.max(2, Math.round(0.02 * len)));
  // Text placement: opposite the arrow's direction, off the tail (TV).
  const dirAng = Math.atan2(dxv, dyv); // TV convention: atan2(dx, dy)
  let tx = a0.x;
  let ty = a0.y;
  let anchor: "start" | "middle" | "end" = "middle";
  if (dirAng > -Math.PI / 4 && dirAng < Math.PI / 4) {
    ty -= 8; // arrow points down → text above the tail
  } else if (dirAng > (3 * Math.PI) / 4 || dirAng < (-3 * Math.PI) / 4) {
    ty += 8 + fs; // arrow points up → text below the tail
  } else if (dirAng < 0) {
    tx += 10; anchor = "start"; ty += fs * 0.35; // points left → text right
  } else {
    tx -= 10; anchor = "end"; ty += fs * 0.35; // points right → text left
  }
  const out: Scene = [
    { t: "hit", a, b, width: Math.max(12, (1.22 * head) / 2) },
    { t: "polygon", pts: outline, fill: s.color, stroke: s.color, strokeWidth: strokeW, join: "round", cap: "round" },
    ...textItems(tx, ty, anchor),
  ];
  if (selected) out.push({ t: "anchors", pts });
  return out;
}

/** TV arrow mark (line-tool-arrow-mark, module 501042): block arrow with its
 *  tip on the point — head 12px long × 19.5px wide, stem 10px long × 10px
 *  wide, filled in the arrow colour. Optional text (TV `text`, font 14,
 *  colour = the text colour): centred, its box (padding fs/3) 20px below the
 *  point for an up arrow, 20px above it for a down arrow. */
function arrowMarkPath(c: Pt, dir: "up" | "down"): string {
  const k = dir === "up" ? 1 : -1;
  const head = k * 12;
  const stem = k * 10;
  const hw = 19.5 / 2;
  const sw = 5;
  return `M ${c.x} ${c.y} L ${c.x + hw} ${c.y + head} L ${c.x + sw} ${c.y + head} L ${c.x + sw} ${c.y + head + stem} L ${c.x - sw} ${c.y + head + stem} L ${c.x - sw} ${c.y + head} L ${c.x - hw} ${c.y + head} Z`;
}

export function sceneArrowMark(d: Drawing, pts: Pt[], selected: boolean, s: DrawingStyle, dir: "up" | "down"): Scene {
  const c = pts[0];
  const box = arrowMarkTextBox(d, c);
  const fs = s.fontSize ?? 14;
  const out: Scene = [{ t: "path", d: arrowMarkPath(c, dir), fill: s.color }];
  if (box) {
    // TV hit-tests the text box too: transparent pointer target
    out.push({ t: "rect", x: box.left, y: box.top, w: box.width, h: box.height, fill: "transparent" });
    box.lines.forEach((ln, i) => {
      out.push({
        t: "text", x: c.x, y: box.top + box.pad + i * box.lineH, text: ln, anchor: "middle", baseline: "hanging", size: fs,
        weight: s.bold ? 700 : 400, fontStyle: s.italic ? "italic" : "normal", fill: s.textColor ?? s.color, inert: true, pre: true,
      });
    });
  }
  if (selected) out.push({ t: "anchors", pts: [c] });
  return out;
}

/* ---------- flag marker (1-point pennant on a pole; LineToolFlagMark) ----------
 * Geometry traced from the captured tool icon (tradingview-agent
 * tool-icons/flag-mark.svg): a swallowtail banner that flies up-and-right from
 * a vertical pole rooted at the anchor point. */
const FLAG_POLE_H = 22;
const FLAG_W = 17;
const FLAG_H = 12;
const FLAG_NOTCH = 5; // depth of the right-edge V-notch (swallowtail)

export function sceneFlagMark(pts: Pt[], selected: boolean, s: DrawingStyle): Scene {
  const c = pts[0];
  const topY = c.y - FLAG_POLE_H;
  const fx = c.x;
  // Banner: top-left → top-right → notch-in → bottom-right → bottom-left.
  const banner: Pt[] = [
    { x: fx, y: topY },
    { x: fx + FLAG_W, y: topY },
    { x: fx + FLAG_W - FLAG_NOTCH, y: topY + FLAG_H / 2 },
    { x: fx + FLAG_W, y: topY + FLAG_H },
    { x: fx, y: topY + FLAG_H },
  ];
  const out: Scene = [
    // fat transparent hit target over pole + banner
    { t: "rect", x: fx - HIT_TOLERANCE, y: topY - HIT_TOLERANCE, w: FLAG_W + HIT_TOLERANCE * 2, h: FLAG_POLE_H + HIT_TOLERANCE * 2, fill: "transparent" },
    { t: "line", a: { x: fx, y: topY }, b: { x: fx, y: c.y }, stroke: s.color, strokeWidth: Math.max(2, s.width + 1), cap: "round" },
    { t: "polygon", pts: banner, fill: s.color, stroke: s.color, strokeWidth: 1, join: "round" },
  ];
  if (selected) out.push({ t: "anchors", pts: [c] });
  return out;
}

/** TV price label (line-tool-price-label): the price in a box whose bottom
 *  left is 9px right of and 15px above the point, a tail to the point, bold
 *  text 10px in (factory white 14px on tv-blue-500), border 2px, a 2.5px dot
 *  at the point ringed in the chart background. */
export function scenePriceLabel(d: Drawing, pts: Pt[], selected: boolean, s: DrawingStyle, coords: Coords | null): Scene {
  const c = pts[0];
  const pip = coords?.pipSize() ?? 0.01;
  const digits = Math.max(0, Math.min(8, Math.round(-Math.log10(pip))));
  const label = d.points[0].price.toFixed(digits);
  const fs = s.fontSize ?? 14;
  const b = priceLabelLayout(label, c, fs);
  const t = 100 - (s.transparency ?? 0);
  const border = s.borderColor ?? s.color;
  const out: Scene = [
    { t: "path", d: priceLabelPath(b), fill: applyOpacity(parseColor(s.backgroundColor ?? s.color).hex, t), stroke: border, strokeWidth: 2, join: "round" },
    { t: "text", x: b.x + 10, y: b.y + b.h / 2 + Math.floor(0.35 * fs), text: label, size: fs, weight: "bold", fill: s.textColor ?? "#ffffff", pre: true },
    { t: "circle", cx: c.x, cy: c.y, r: 2.5, fill: applyOpacity(parseColor(border).hex, t), stroke: "#0f0f0f", strokeWidth: 1 },
  ];
  if (selected) out.push({ t: "anchors", pts: [c] });
  return out;
}

/** Side of the font-icon glyph box (centered on the placement point). */
const FONT_ICON_SIZE = 28;

/** Font-icon glyph (emoji char OR raw `<svg>` markup) centered on the point;
 *  selected: a dashed box around it (no anchor handle). */
export function sceneFontIcon(d: Drawing, pts: Pt[], selected: boolean): Scene {
  const [c] = pts;
  // TV's factory glyph size is 72; drawings saved before the size existed
  // keep the old 28px box.
  const size = d.style.fontSize ?? FONT_ICON_SIZE;
  const half = size / 2;
  const items: SceneItem[] = [];
  if (selected) {
    items.push({ t: "rect", x: c.x - half - 2, y: c.y - half - 2, w: size + 4, h: size + 4, fill: "none", stroke: "#2962ff", strokeWidth: 1, dash: "3 3", rx: 3 });
  }
  items.push({ t: "glyph", x: c.x - half, y: c.y - half, size, glyph: d.glyph ?? "", color: d.style.color });
  return [{ t: "group", items }];
}

/* ---------- candle replicas (bars-pattern / ghost-feed) ----------
 * Both draw OHLC candles between the two anchor points. bar-pattern renders
 * the FROZEN snapshot captured at placement (`d.pattern`, TV model) anchored
 * at p0 with a price offset — real scale, never renormalised — with display
 * modes (bars/line) and mirror/flip transforms from the style; only legacy
 * saves without a snapshot fall back to live-resampling into the box.
 * ghost-feed synthesises deterministic candles from its frozen seed +
 * amplitude (`d.ghost`), jittered by the style's variance. */
const CANDLE_UP = "#089981";
const CANDLE_DOWN = "#f23645";

type Candle = { x: number; openY: number; highY: number; lowY: number; closeY: number; up: boolean };

/** OHLC candles given per-bar screen coords. */
function candleItems(bars: Candle[], bodyW: number): SceneItem[] {
  const out: SceneItem[] = [];
  for (const bar of bars) {
    const color = bar.up ? CANDLE_UP : CANDLE_DOWN;
    const top = Math.min(bar.openY, bar.closeY);
    const bh = Math.max(1, Math.abs(bar.closeY - bar.openY));
    out.push(
      { t: "line", a: { x: bar.x, y: bar.highY }, b: { x: bar.x, y: bar.lowY }, stroke: color, strokeWidth: 1 },
      { t: "rect", x: bar.x - bodyW / 2, y: top, w: bodyW, h: bh, fill: color },
    );
  }
  return out;
}

/** Bars pattern (TV line-tool-bars-pattern, module 432434). Geometry in
 *  kinds/bars-pattern.ts (shared with the hit test). HL / OC bars: 2px bars
 *  (x ± 1) filled and bordered in the tool colour at transparency 10; line
 *  modes: a 2px line at transparency 10. Without a snapshot TV draws two
 *  vertical lines and the P0-P1 median in cold gray. */
export function sceneBarsPattern(d: Drawing, pts: Pt[], selected: boolean, s: DrawingStyle, coords: Coords | null): Scene {
  if (d.kind !== "bar-pattern") return [];
  const [pa, pb] = pts;
  const g = barsPatternGeometry(d, pts, coords);
  const anchors: Scene = selected ? [{ t: "anchors", pts }] : [];
  if (!g) {
    const gray = { stroke: "#808080", strokeWidth: 1, inert: true };
    return [
      { t: "line", a: { x: pa.x, y: 0 }, b: { x: pa.x, y: 99999 }, ...gray },
      { t: "line", a: { x: pb.x, y: 0 }, b: { x: pb.x, y: 99999 }, ...gray },
      { t: "line", a: pa, b: pb, ...gray },
      ...anchors,
    ];
  }
  const color = s.color;
  const tol = strokeTolerance(s);
  // pointer targets = the drawn bars / line widened by the hit tolerance
  // (the same region as barsPatternHit)
  if (g.lineMode) {
    return [
      { t: "polyline", pts: g.line, fill: "none", stroke: "transparent", strokeWidth: tol * 2 },
      { t: "polyline", pts: g.line, fill: "none", stroke: color, strokeOpacity: 0.9, strokeWidth: 2, inert: true },
      ...anchors,
    ];
  }
  return [
    ...g.bars.map((b): SceneItem => ({ t: "rect", x: b.x - 1 - tol, y: b.top - tol, w: 2 + 2 * tol, h: b.bottom - b.top + 2 * tol, fill: "transparent" })),
    {
      t: "group",
      inert: true,
      items: g.bars.map((b): SceneItem => ({
        t: "rect", x: b.x - 1, y: b.top, w: 2, h: Math.max(1, b.bottom - b.top), fill: color, fillOpacity: 0.9, stroke: color, strokeWidth: 1,
      })),
    },
    ...anchors,
  ];
}

/** Deterministic [0,1) PRNG (mulberry32) so synthetic candles are stable across
 *  re-renders/pan/zoom — seeded from the box geometry, not a live clock. */
function seededRng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const GHOST_BARS = 14;

export function sceneGhostFeed(d: Drawing, pts: Pt[], selected: boolean, s: DrawingStyle, coords: Coords | null): Scene {
  if (d.kind !== "ghost-feed") return [];
  // TV model (variable-length): every vertex pair is one drift segment; one
  // candle per bar index along each leg — legs after the first skip their
  // start vertex bar (GhostBarsSegment.generate: `_segmentIndex ? t.index + 1
  // : t.index`) and the end vertex bar is always excluded, so a shared vertex
  // never gets two candles. Amplitude frozen at placement (ATR-like), seed
  // persisted so the simulation is stable across moves/reloads and resizes
  // with a drag.
  // TV line-tool-ghost-feed (module 868823). Segment n spans the bar indices
  // [min, min + size) with size = |Δindex| (first segment) or |Δindex| − 1;
  // its drift runs in screen space from the left point's price (e = 0) to
  // the right point's price (e = size − 1). Each bar (TV `_createBar`,
  // averageHL = the frozen amplitude): centre offset amp·(1 − 2r)·v, range
  // amp·(1 + (0.5 − r)·v), open / close random inside the range. Candles:
  // body up #ACE5DC / down #FAA1A4, border up #089981 / down #F23645, wick
  // #808080, the whole candle layer at alpha 1 − transparency / 100 (50);
  // body half-width floor(0.3 · bar spacing) (TV optimalBarWidth). The
  // drift lines are cold gray #808080 1px.
  if (d.ghost && coords && d.points.length >= 2) {
    const amp = d.ghost.amplitude;
    const vt = Math.max(0, Math.min(1, (s.variance ?? 50) / 100));
    const candles: Candle[] = [];
    let spacing = 8;
    let anyLeg = false;
    for (let k = 0; k < d.points.length - 1; k++) {
      const idxA = coords.timeToBarIndex(d.points[k].time);
      const idxB = coords.timeToBarIndex(d.points[k + 1].time);
      if (idxA == null || idxB == null || idxA === idxB) continue;
      anyLeg = true;
      const leftFirst = pts[k].x <= pts[k + 1].x;
      const yL = coords.priceToY(leftFirst ? d.points[k].price : d.points[k + 1].price);
      const yR = coords.priceToY(leftFirst ? d.points[k + 1].price : d.points[k].price);
      if (yL == null || yR == null) continue;
      const lo = Math.min(idxA, idxB);
      const size = Math.abs(idxB - idxA) - (k === 0 ? 0 : 1);
      const stepY = size > 1 ? (yR - yL) / (size - 1) : 0;
      for (let e = 0; e < size; e++) {
        const t = coords.barIndexToTime(lo + e);
        const x = t == null ? null : coords.timeToX(t);
        if (x == null) continue;
        if (e > 0) {
          const tp = coords.barIndexToTime(lo + e - 1);
          const xp = tp == null ? null : coords.timeToX(tp);
          if (xp != null) spacing = Math.abs(x - xp) || spacing;
        }
        const level = coords.yToPrice(yL + e * stepY);
        if (level == null) continue;
        // One seed per drawing; the per-bar stream mixes the leg and the bar
        // offset inside the leg.
        const r = seededRng((d.ghost.seed ^ Math.imul(k, 0x9e3779b9) ^ Math.imul(e, 2654435761)) >>> 0);
        const centerOff = amp * (1 - 2 * r()) * vt;
        const range = Math.max(1e-9, amp * (1 + (0.5 - r()) * vt));
        const low = centerOff - range / 2;
        const o = low + r() * range;
        const c2 = low + r() * range;
        const oy = coords.priceToY(level + o);
        const hy = coords.priceToY(level + low + range);
        const ly = coords.priceToY(level + low);
        const cy = coords.priceToY(level + c2);
        if (oy == null || hy == null || ly == null || cy == null) continue;
        candles.push({ x, openY: oy, highY: hy, lowY: ly, closeY: cy, up: c2 >= o });
      }
    }
    if (anyLeg) {
      const half = Math.floor(0.3 * spacing);
      const cs = s.ghostCandle ?? GHOST_CANDLE_DEFAULTS;
      const yA = coords.priceToY(d.points[0].price);
      const yB = coords.priceToY(d.points[0].price + amp);
      const bandPx = yA != null && yB != null ? Math.abs(yB - yA) : 10;
      const items: SceneItem[] = [];
      for (const bar of candles) {
        if (cs.drawWick) {
          items.push({ t: "line", a: { x: bar.x, y: bar.highY }, b: { x: bar.x, y: bar.lowY }, stroke: cs.wickColor, strokeWidth: 1 });
        }
        items.push({
          t: "rect", x: Math.round(bar.x) - half - 0.5, y: Math.min(bar.openY, bar.closeY), w: 2 * half + 1, h: Math.max(1, Math.abs(bar.closeY - bar.openY)),
          fill: bar.up ? cs.upColor : cs.downColor, stroke: cs.drawBorder ? (bar.up ? cs.borderUpColor : cs.borderDownColor) : "none", strokeWidth: 1,
        });
      }
      const out: Scene = [
        { t: "polyline", pts, fill: "none", stroke: "transparent", strokeWidth: Math.max(12, bandPx * 2) },
        { t: "polyline", pts, fill: "none", stroke: "#808080", strokeWidth: 1, inert: true },
        { t: "group", inert: true, opacity: 1 - (s.transparency ?? 50) / 100, items },
      ];
      if (selected) out.push({ t: "anchors", pts });
      return out;
    }
  }
  const [pa, pb] = pts;
  const left = Math.min(pa.x, pb.x);
  const right = Math.max(pa.x, pb.x);
  const top = Math.min(pa.y, pb.y);
  const bottom = Math.max(pa.y, pb.y);
  const boxW = right - left;
  const boxH = bottom - top;
  // Seed from the box's data coords so the walk is reproducible for this drawing.
  const seed = Math.round((d.points[0].price + d.points[1].price) * 1000) ^ ((timeToSec(d.points[0].time) ?? 0) | 0);
  const rng = seededRng(seed);
  const slot = boxW / GHOST_BARS;
  const bodyW = Math.max(1, slot * 0.6);
  const wick = boxH * 0.06;
  const amp = boxH * 0.12;
  let level = top + boxH / 2;
  const candles: Candle[] = [];
  for (let i = 0; i < GHOST_BARS; i++) {
    const openY = level;
    const drift = (rng() - 0.5) * 2 * amp;
    let closeY = openY + drift;
    closeY = Math.max(top + wick, Math.min(bottom - wick, closeY));
    const highY = Math.min(openY, closeY) - rng() * wick;
    const lowY = Math.max(openY, closeY) + rng() * wick;
    candles.push({ x: left + slot * (i + 0.5), openY, highY, lowY, closeY, up: closeY <= openY });
    level = closeY;
  }
  const out: Scene = [
    { t: "rect", x: left, y: top, w: boxW, h: boxH, fill: s.color, fillOpacity: 0.04, stroke: s.color, strokeWidth: s.width, dash: "4 3" },
    // dotted guide line through the walk's midline (matches the icon)
    { t: "line", a: { x: left, y: top + boxH / 2 }, b: { x: right, y: top + boxH / 2 }, stroke: s.color, strokeWidth: 1, strokeOpacity: 0.4, dash: "2 3", inert: true },
    { t: "group", inert: true, items: candleItems(candles, bodyW) },
  ];
  if (selected) {
    for (const c of bboxCorners(pa, pb)) {
      out.push({ t: "circle", cx: c.x, cy: c.y, r: HANDLE_RADIUS, fill: "#fff", stroke: s.color, strokeWidth: 1.5, cursor: "nwse-resize" });
    }
  }
  return out;
}
