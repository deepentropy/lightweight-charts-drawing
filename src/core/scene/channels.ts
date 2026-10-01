/*
 * Channel tools as scenes (moved from OpenTrader DrawingsOverlay, port
 * phase 2): parallel channel, disjoint channel, flat top/bottom.
 */
import { dashFor, type Pt } from "../_shared";
import type { Coords } from "../coords";
import type { Drawing, DrawingStyle, LevelDef } from "../types";
import { PARALLEL_CHANNEL_LEVEL_DEFAULTS } from "../specs";
import { tvTextLayout } from "../kinds/tv-text";
import type { Scene, SceneItem } from "./types";
import { channelLabelCutPoly, channelLabelItems, tvTextItems } from "./text";
import { endArrowItems, SQUARE_ANCHORS } from "./lines";
import { extendSeg, levelDash, levelFillOpacity, levelWidth } from "./levels";

/** Parallel channel anchors (TV line-tool-parallel-channel): p0, p1, their
 *  copies on the second line, the two middle points; `dy` = the second
 *  line's vertical offset at p0. */
export function parallelChannelAnchors(pts: Pt[]): { anchors: Pt[]; dy: number } {
  const [a, b, c] = pts;
  const t = b.x - a.x === 0 ? 0 : (c.x - a.x) / (b.x - a.x);
  const dy = c.y - (a.y + (b.y - a.y) * t);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return {
    anchors: [a, b, { x: a.x, y: a.y + dy }, { x: b.x, y: b.y + dy }, { x: mid.x, y: mid.y + dy }, mid],
    dy,
  };
}

/** Disjoint channel (TV mirror model): edge 2 has the mirrored slope of edge
 *  1 and passes through (p1.x, y(p2)). Anchors: 0 / 1 = edge-1 ends, 2 =
 *  edge-2 end at p1.x (→ p2 price), 3 = edge-2 end at p0.x. */
export function disjointChannelAnchors(pts: Pt[]): { anchors: Pt[]; P: Pt; A: Pt } {
  const [a, b, c] = pts;
  const P = { x: b.x, y: c.y };
  const A = { x: a.x, y: c.y + (b.y - a.y) };
  return { anchors: [a, b, P, A], P, A };
}

/** Parallel channel label edges (TV line-tool-parallel-channel): the first
 *  and last visible level lines; levels 0 and 1 for the Middle alignment. */
export function parallelChannelLabelEdges(a: Pt, b: Pt, dy: number, levels: LevelDef[], s: DrawingStyle) {
  const mid = (s.vertLabelsAlign ?? "bottom") === "middle";
  const c1 = mid ? 0 : levels.length > 0 ? levels[0].coeff : 0;
  const c2 = mid ? 1 : levels.length > 0 ? levels[levels.length - 1].coeff : 0;
  return { e: { x: a.x, y: a.y + dy * c1 }, t: { x: b.x, y: b.y + dy * c1 }, i: { x: a.x, y: a.y + dy * c2 }, n: { x: b.x, y: b.y + dy * c2 } };
}

export function sceneParallelChannel(pts: Pt[], selected: boolean, s: DrawingStyle, w: number, h: number): Scene {
  const [a, b] = pts;
  const { anchors, dy } = parallelChannelAnchors(pts);
  // TV line-tool-parallel-channel (v2): each visible level (in level order) is
  // the p0-p1 line moved by coeff * (p2 - p0); the background fills every
  // band between two consecutive visible levels. One visible level = no band.
  const levels = (s.levels ?? PARALLEL_CHANNEL_LEVEL_DEFAULTS).filter((l) => l.visible);
  // TV extendLeft / extendRight: every line and band runs to the pane edges.
  const big = (w + h) * 2;
  const at = (coeff: number) => extendSeg({ x: a.x, y: a.y + dy * coeff }, { x: b.x, y: b.y + dy * coeff }, !!s.extendLeft, !!s.extendRight, big);
  const fillO = levelFillOpacity(s);
  const fill = s.backgroundColor ?? s.color;
  // TV: a Middle label cuts every channel line (no odd-line test here).
  const ed = parallelChannelLabelEdges(a, b, dy, levels, s);
  const cutPoly = channelLabelCutPoly(ed.e, ed.t, ed.i, ed.n, s, undefined, true);
  const clip = cutPoly && cutPoly.length ? "cut" : undefined;
  const items: SceneItem[] = [];
  if (clip) items.push({ t: "clip", name: clip, polys: [cutPoly!] });
  levels.slice(1).forEach((hi, i) => {
    const lo = at(levels[i].coeff);
    const up = at(hi.coeff);
    items.push({ t: "polygon", pts: [lo.l, lo.r, up.r, up.l], fill, fillOpacity: fillO, stroke: "transparent" });
  });
  for (const lvl of levels) {
    const g = at(lvl.coeff);
    items.push({ t: "hit", a: g.l, b: g.r, width: 12 });
    items.push({ t: "line", a: g.l, b: g.r, stroke: lvl.color, strokeWidth: levelWidth(lvl, s), dash: levelDash(lvl, s), clip });
  }
  items.push(...channelLabelItems(ed.e, ed.t, ed.i, ed.n, s));
  if (selected) items.push({ t: "anchors", pts: anchors, squares: SQUARE_ANCHORS.parallelChannel });
  return items;
}

/** TV flat top/bottom and disjoint channel "Prices": each line end's price in
 *  12px text 6px outside the end (no box). */
export function channelPricesItems(a: Pt, b: Pt, pa: string, pb: string, s: DrawingStyle): SceneItem[] {
  const lay = (p: Pt, other: Pt, text: string) =>
    tvTextLayout({ x: p.x, y: p.y, text, fs: s.priceLabelFontSize ?? 12, bold: s.priceLabelBold, italic: s.priceLabelItalic, vert: "middle", horz: p.x > other.x ? "left" : "right", offsetX: 6, padH: 0, padV: 0 });
  const color = s.priceLabelTextColor ?? s.color;
  return [
    tvTextItems(lay(a, b, pa), color, s.priceLabelBold, s.priceLabelItalic),
    tvTextItems(lay(b, a, pb), color, s.priceLabelBold, s.priceLabelItalic),
  ];
}

/** TV flat top/bottom and disjoint channel body (module 632446): both lines
 *  with the tool's extend flags and line ends, the band between them filled
 *  with the background colour (alpha = 1 - transparency, factory 0.2) and
 *  extended with the lines, the prices. */
export function channelBodyItems(d: Drawing, a: Pt, b: Pt, A: Pt, P: Pt, priceB: number, priceB2: number, s: DrawingStyle, w: number, h: number, coords: Coords | null): SceneItem[] {
  const big = (w + h) * 2;
  const l1 = extendSeg(a, b, !!s.extendLeft, !!s.extendRight, big);
  const l2 = extendSeg(A, P, !!s.extendLeft, !!s.extendRight, big);
  const dash = dashFor(s);
  const cap = ((s.lineStyle ?? "solid") === "solid" ? "round" : "butt") as "round" | "butt";
  const digits = Math.max(0, Math.min(8, Math.round(-Math.log10(coords?.pipSize() ?? 0.01))));
  const fmt = (v: number) => v.toFixed(digits);
  const items: SceneItem[] = [];
  if (s.fillBackground !== false) items.push({ t: "polygon", pts: [l1.l, l1.r, l2.r, l2.l], fill: s.backgroundColor ?? s.color, fillOpacity: levelFillOpacity(s), stroke: "transparent" });
  items.push(
    { t: "hit", a, b, width: 12 },
    { t: "hit", a: A, b: P, width: 12 },
    { t: "line", a: l1.l, b: l1.r, stroke: s.color, strokeWidth: s.width, dash, cap },
    { t: "line", a: l2.l, b: l2.r, stroke: s.color, strokeWidth: s.width, dash, cap },
  );
  if (s.leftEnd === 1) items.push(...endArrowItems(b, a, s), ...endArrowItems(P, A, s));
  if (s.rightEnd === 1) items.push(...endArrowItems(a, b, s), ...endArrowItems(A, P, s));
  if (s.showPrices) {
    items.push(...channelPricesItems(a, b, fmt(d.points[0]?.price ?? 0), fmt(d.points[1]?.price ?? 0), s));
    items.push(...channelPricesItems(P, A, fmt(priceB), fmt(priceB2), s));
  }
  return items;
}

export function sceneDisjointChannel(d: Drawing, pts: Pt[], selected: boolean, s: DrawingStyle, w: number, h: number, coords: Coords | null): Scene {
  const [a, b] = pts;
  const { anchors, P, A } = disjointChannelAnchors(pts);
  const p2 = d.points[2]?.price ?? d.points[0].price;
  return [
    ...channelBodyItems(d, a, b, A, P, p2, p2 + ((d.points[1]?.price ?? 0) - d.points[0].price), s, w, h, coords),
    ...channelLabelItems(a, b, A, P, s),
    ...(selected ? [{ t: "anchors" as const, pts: anchors, squares: SQUARE_ANCHORS.disjointChannel }] : []),
  ];
}

/** Flat top/bottom channel: main edge pt0→pt1, second edge a horizontal line
 *  at pt2's price spanning the same x range. */
export function sceneFlatTopBottom(d: Drawing, pts: Pt[], selected: boolean, s: DrawingStyle, w: number, h: number, coords: Coords | null): Scene {
  const [a, b, c] = pts;
  const A = { x: a.x, y: c.y };
  const P = { x: b.x, y: c.y };
  const p2 = d.points[2]?.price ?? d.points[0].price;
  return [
    ...channelBodyItems(d, a, b, A, P, p2, p2, s, w, h, coords),
    ...channelLabelItems(a, b, A, P, s),
    ...(selected ? [{ t: "anchors" as const, pts }] : []),
  ];
}
