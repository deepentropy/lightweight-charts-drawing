/*
 * Fibonacci tools as scenes (moved from OpenTrader DrawingsOverlay, port
 * phase 2): retracement, trend-based extension, channel, time zone,
 * trend-based time, circles, speed resistance fan / arcs, spiral, wedge,
 * pitchfan.
 */
import { dashFor, HIT_TOLERANCE, type Pt } from "../_shared";
import type { Coords } from "../coords";
import type { Drawing, DrawingStyle, LevelDef } from "../types";
import {
  FIB_CIRCLE_LEVEL_DEFAULTS, FIB_LEVEL_DEFAULTS, FIB_TIMEZONE_LEVEL_DEFAULTS, FIB_TREND_LINE_DEFAULT, FIB_WEDGE_LEVEL_DEFAULTS,
  FIB_WEDGE_TREND_LINE_DEFAULT, PITCHFORK_LEVEL_DEFAULTS, SPEED_ARC_LEVEL_DEFAULTS, SPEED_FAN_GRID_DEFAULT, SPEED_FAN_LEVEL_DEFAULTS,
  TREND_FIB_TIME_LEVEL_DEFAULTS, TREND_FIB_TIME_TREND_DEFAULT,
} from "../specs";
import { tvTextLayout } from "../kinds/tv-text";
import { fibCoeffText, fibLevelLabel } from "../kinds/fib-labels";
import { trendFibTimeLevels } from "../kinds/fib-time";
import { extendRay, speedFanGeometry } from "../kinds/speed-fan";
import { spiralSamples } from "../kinds/hit-tests";
import type { Scene, SceneItem } from "./types";
import { textCrossesLine, tvTextItems } from "./text";
import { activeLevels, extendSeg, levelDash, levelFillOpacity, levelWidth } from "./levels";

/** "0.618" without trailing zeros. */
export function fmtCoeff(c: number): string {
  return c.toFixed(3).replace(/0+$/, "").replace(/\.$/, "") || "0";
}

const anchorsIf = (selected: boolean, pts: Pt[]): SceneItem[] => (selected ? [{ t: "anchors", pts }] : []);
const digitsOf = (coords: Coords | null) => Math.max(0, Math.min(8, Math.round(-Math.log10(coords?.pipSize() ?? 0.01))));

/** A cut-out clip for the given polygons (none when all are empty). */
function clipOf(name: string, polys: (Pt[] | null | undefined)[]): { items: SceneItem[]; clip: string | undefined } {
  const ps = polys.filter((x): x is Pt[] => !!x && x.length > 0);
  return ps.length ? { items: [{ t: "clip", name, polys: ps }], clip: name } : { items: [], clip: undefined };
}

/** TV fib "Trend line" (trendline: visible / colour / width / style). */
export function fibTrendLineItems(a: Pt, b: Pt, s: DrawingStyle, wedge = false): SceneItem[] {
  const tl = s.fibTrendLine ?? (wedge ? FIB_WEDGE_TREND_LINE_DEFAULT : FIB_TREND_LINE_DEFAULT);
  if (!tl.visible) return [];
  return [{ t: "line", a, b, stroke: tl.color, strokeWidth: tl.width, dash: dashFor({ ...s, lineStyle: tl.style }), cap: tl.style === "solid" ? "round" : "butt", inert: true }];
}

/** A horizontal fib level with its TV label (value / price) and level text;
 *  the line is cut behind both (TV exclusion path). */
export function fibHLevelItems(name: string, lvl: LevelDef, y: number, left: number, right: number, price: number, digits: number, s: DrawingStyle, paneW: number): SceneItem[] {
  const base = { y, left, right, extendLeft: !!s.extendLeft, extendRight: !!s.extendRight, paneW, fs: s.labelFontSize ?? 12 };
  const showC = s.showCoeffs !== false;
  const showP = s.showPrices !== false;
  let text = "";
  if (showC) text += fibCoeffText(lvl.coeff, !!s.fibLevelsAsPercents);
  if (showP) text += ` (${price.toFixed(digits)})`;
  const label = fibLevelLabel({ ...base, text, horz: s.horzLabelsAlign ?? "left", vert: s.vertLabelsAlign ?? "middle" });
  const lvText = s.showText !== false && lvl.text ? fibLevelLabel({ ...base, text: lvl.text, horz: s.horzTextAlign ?? "center", vert: s.vertTextAlign ?? "middle" }) : null;
  const cut = clipOf(name, [label?.poly ?? null, lvText?.poly]);
  return [
    { t: "hit", a: { x: left, y }, b: { x: right, y }, width: 10 },
    ...cut.items,
    { t: "line", a: { x: left, y }, b: { x: right, y }, stroke: lvl.color, strokeWidth: levelWidth(lvl, s), dash: levelDash(lvl, s), clip: cut.clip },
    ...(label ? [tvTextItems(label, lvl.color)] : []),
    ...(lvText ? [tvTextItems(lvText, lvl.color)] : []),
  ];
}

/** Background bands between neighbouring levels over [left, right] (in the
 *  upper level's colour). */
function hBands(levels: LevelDef[], yOf: (c: number) => number, left: number, right: number, fillO: number): SceneItem[] {
  if (!(fillO > 0)) return [];
  return levels.slice(1).map((hi, i) => {
    const y0 = yOf(levels[i].coeff);
    const y1 = yOf(hi.coeff);
    return { t: "rect" as const, x: left, y: Math.min(y0, y1), w: Math.max(1, right - left), h: Math.abs(y1 - y0), fill: hi.color, fillOpacity: fillO, stroke: "none", inert: true };
  });
}

export function sceneFib(d: Drawing, pts: Pt[], selected: boolean, w: number, s: DrawingStyle, coords: Coords | null): Scene {
  if (d.kind !== "fib-retracement") return [];
  const [a, b] = pts;
  const priceA = d.points[0].price;
  const priceB = d.points[1].price;
  // TV: levels span the anchors' x-range; the extend flags (default off)
  // stretch them to the pane edges.
  const left = s.extendLeft ? 0 : Math.min(a.x, b.x);
  const right = s.extendRight ? w : Math.max(a.x, b.x);
  const levels = activeLevels(s, FIB_LEVEL_DEFAULTS);
  // "Fib levels based on log scale" (TV fibLevelsBasedOnLogScale): level
  // prices interpolate in ln(price) space; TV only honours it on a log price
  // scale, and non-positive anchors (no ln) fall back to linear.
  const useLog = !!s.fibLevelsBasedOnLogScale && !!coords?.isLog() && priceA > 0 && priceB > 0;
  // reverse mirrors the ladder: 0 at the first click instead of the second.
  const priceOf = (c: number) => {
    const pEnd = s.reverse ? priceA : priceB; // coeff-0 anchor
    const pStart = s.reverse ? priceB : priceA;
    return useLog ? Math.exp(Math.log(pEnd) + c * (Math.log(pStart) - Math.log(pEnd))) : pEnd + c * (pStart - pEnd);
  };
  // TV fibLevelCoordinate: log mode interpolates the anchors' coordinates;
  // linear mode maps the level price through the scale.
  const yLin = (c: number) => (s.reverse ? a.y + (b.y - a.y) * c : b.y + (a.y - b.y) * c);
  const yOf = (c: number) => (useLog ? yLin(c) : coords?.priceToY(priceOf(c)) ?? yLin(c));
  const digits = digitsOf(coords);
  return [
    ...hBands(levels, yOf, left, right, levelFillOpacity(s)),
    ...levels.flatMap((lvl, i) => fibHLevelItems(`l${i}`, lvl, yOf(lvl.coeff), left, right, priceOf(lvl.coeff), digits, s, w)),
    // TV draws the trend line after the levels, before the labels.
    ...fibTrendLineItems(a, b, s),
    ...anchorsIf(selected, pts),
  ];
}

/** Trend-based fib extension: levels of the pt0→pt1 move projected from pt2
 *  over the x-range of points 2 and 3; `reverse` flips the measured leg. */
export function sceneFibExtension(d: Drawing, pts: Pt[], selected: boolean, w: number, s: DrawingStyle, coords: Coords | null): Scene {
  if (d.kind !== "trend-based-fib-extension") return [];
  const [, b, c] = pts;
  const p0 = d.points[0].price;
  const p1 = d.points[1].price;
  const pc = d.points[2].price;
  const move = s.reverse ? p0 - p1 : p1 - p0;
  const moveY = s.reverse ? pts[0].y - pts[1].y : pts[1].y - pts[0].y;
  const levels = activeLevels(s, FIB_LEVEL_DEFAULTS);
  const left = s.extendLeft ? 0 : Math.min(b.x, c.x);
  const right = s.extendRight ? w : Math.max(b.x, c.x);
  // Log scale (TV): the move projects from pc in ln(price) space.
  const useLog = !!s.fibLevelsBasedOnLogScale && !!coords?.isLog() && p0 > 0 && p1 > 0 && pc > 0;
  const priceOf = (lvl: number) => {
    if (!useLog) return pc + move * lvl;
    const lnMove = s.reverse ? Math.log(p0) - Math.log(p1) : Math.log(p1) - Math.log(p0);
    return Math.exp(Math.log(pc) + lvl * lnMove);
  };
  const yLin = (lvl: number) => c.y + moveY * lvl;
  const yOf = (lvl: number) => (useLog ? yLin(lvl) : coords?.priceToY(priceOf(lvl)) ?? yLin(lvl));
  const digits = digitsOf(coords);
  return [
    ...hBands(levels, yOf, left, right, levelFillOpacity(s)),
    ...levels.flatMap((lvl, i) => fibHLevelItems(`l${i}`, lvl, yOf(lvl.coeff), left, right, priceOf(lvl.coeff), digits, s, w)),
    // TV trend line: the measured move and the projection leg.
    ...fibTrendLineItems(pts[0], pts[1], s),
    ...fibTrendLineItems(pts[1], pts[2], s),
    ...anchorsIf(selected, pts),
  ];
}

/** Fib channel: level k = the p0→p1 segment moved by coeff·(p2 − p0); fills
 *  between levels (lower level colour), labels at the chosen end, each line
 *  cut behind its own label. */
export function sceneFibChannel(d: Drawing, pts: Pt[], selected: boolean, s: DrawingStyle, coords: Coords | null, w: number, h: number): Scene {
  if (d.kind !== "fib-channel") return [];
  const [a, b, c] = pts;
  const nx = c.x - a.x;
  const ny = c.y - a.y;
  // TV extendLeft / extendRight: the level lines (and fills) to the pane
  // edges; labels keep the level ends.
  const big = (w + h) * 2;
  const at = (coeff: number) => ({ l: { x: a.x + nx * coeff, y: a.y + ny * coeff }, r: { x: b.x + nx * coeff, y: b.y + ny * coeff } });
  const atX = (coeff: number) => {
    const g = at(coeff);
    return extendSeg(g.l, g.r, !!s.extendLeft, !!s.extendRight, big);
  };
  const levels = activeLevels(s, FIB_LEVEL_DEFAULTS);
  const fillO = levelFillOpacity(s);
  const digits = digitsOf(coords);
  const priceAt = (coeff: number, y: number) => coords?.yToPrice(y) ?? d.points[0].price + (d.points[2].price - d.points[0].price) * coeff;
  // TV fib channel labels: value (numbers or percents, 2 decimals) + " (price)"
  // at the level's p0 end (Left: box ending 4px before it; Right: the p1 end,
  // starting 4px after it; Center: the middle). Factory 12px, left / middle.
  const labelFor = (lvl: LevelDef, seg: { l: Pt; r: Pt }) => {
    const showC = s.showCoeffs !== false;
    const showP = s.showPrices !== false;
    if (!showC && !showP) return null;
    let text = "";
    if (showC) text += s.fibLevelsAsPercents ? `${(100 * lvl.coeff).toFixed(2)}%` : fmtCoeff(lvl.coeff);
    if (showP) text += ` (${priceAt(lvl.coeff, seg.l.y).toFixed(digits)})`;
    const horz = s.horzLabelsAlign ?? "left";
    const pt = horz === "left" ? seg.l : horz === "right" ? seg.r : { x: (seg.l.x + seg.r.x) / 2, y: (seg.l.y + seg.r.y) / 2 };
    return tvTextLayout({ x: pt.x, y: pt.y, text, fs: s.labelFontSize ?? 12, vert: s.vertLabelsAlign ?? "middle", horz: horz === "left" ? "right" : horz === "right" ? "left" : "center", offsetX: 4 });
  };
  const items: SceneItem[] = [];
  if (fillO > 0) {
    levels.slice(1).forEach((hi, i) => {
      const lo = atX(levels[i].coeff);
      const up = atX(hi.coeff);
      items.push({ t: "polygon", pts: [lo.l, lo.r, up.r, up.l], fill: levels[i].color, fillOpacity: fillO, stroke: "none", inert: true });
    });
  }
  levels.forEach((lvl, i) => {
    const seg = at(lvl.coeff);
    const segX = atX(lvl.coeff);
    const label = labelFor(lvl, seg);
    const cut = clipOf(`l${i}`, [label ? label.poly : null]);
    items.push({ t: "hit", a: seg.l, b: seg.r, width: 12 }, ...cut.items);
    items.push({ t: "line", a: segX.l, b: segX.r, stroke: lvl.color, strokeWidth: levelWidth(lvl, s), dash: levelDash(lvl, s), clip: cut.clip });
    if (label) items.push(tvTextItems(label, lvl.color));
  });
  items.push(...anchorsIf(selected, pts));
  return items;
}

/** Vertical fib level line with its label (time zone family). */
function vLevelItems(name: string, lvl: LevelDef, x: number, h: number, s: DrawingStyle, label: ReturnType<typeof tvTextLayout> | null, cutPoly: Pt[] | null): SceneItem[] {
  const cut = clipOf(name, [cutPoly]);
  return [
    { t: "hit", a: { x, y: 0 }, b: { x, y: h }, width: 8 },
    ...cut.items,
    { t: "line", a: { x, y: 0 }, b: { x, y: h }, stroke: lvl.color, strokeWidth: levelWidth(lvl, s), dash: levelDash(lvl, s), clip: cut.clip },
    ...(label ? [tvTextItems(label, lvl.color)] : []),
  ];
}

/** Trend-based fib time (TV): dashed trend lines p0-p1-p2, one vertical line
 *  per visible level at bar(p2) + coeff · (bar(p1) − bar(p0)), full-height
 *  fills (later level colour), fib time zone labels; a Center label cuts the
 *  line. */
export function sceneTrendBasedFibTime(d: Drawing, pts: Pt[], selected: boolean, h: number, s: DrawingStyle, coords: Coords | null): Scene {
  const [a, b, c] = pts;
  const tl = s.fibTrendLine ?? TREND_FIB_TIME_TREND_DEFAULT;
  const tlDash = dashFor({ ...s, lineStyle: tl.style, width: tl.width });
  const levels = trendFibTimeLevels(d, pts, coords, activeLevels(s, TREND_FIB_TIME_LEVEL_DEFAULTS));
  const fillO = levelFillOpacity(s);
  const vert = s.vertLabelsAlign ?? "bottom";
  const horzS = s.horzLabelsAlign ?? "right";
  const horz = horzS === "left" ? "right" : horzS === "right" ? "left" : "center";
  const labelAt = (x: number, coeff: number) =>
    s.showLabels === false ? null : tvTextLayout({ x, y: vert === "top" ? 0 : vert === "middle" ? 0.5 * h : h, text: String(coeff), fs: 12, vert, horz, offsetX: 2 });
  const items: SceneItem[] = [];
  if (tl.visible) {
    items.push({ t: "line", a, b, stroke: tl.color, strokeWidth: tl.width, dash: tlDash });
    if (c) items.push({ t: "line", a: b, b: c, stroke: tl.color, strokeWidth: tl.width, dash: tlDash });
  }
  if (fillO > 0) {
    levels.slice(1).forEach((lvl, i) => {
      const x0 = levels[i].x;
      items.push({ t: "rect", x: Math.min(x0, lvl.x), y: 0, w: Math.max(1, Math.abs(lvl.x - x0)), h, fill: lvl.color, fillOpacity: fillO, stroke: "none", inert: true });
    });
  }
  levels.forEach((lvl, i) => {
    const label = labelAt(lvl.x, lvl.coeff);
    items.push(...vLevelItems(`l${i}`, lvl, lvl.x, h, s, label, label && horzS === "center" ? label.poly : null));
  });
  items.push(...anchorsIf(selected, pts));
  return items;
}

/** Fib time zone (TV): vertical level lines at p0 + coeff·(p1 − p0) in x,
 *  labels (level number, 12px, 2px from the line, pane top / middle /
 *  bottom, horizontal side inverted), a Middle label cuts the line. */
export function sceneFibTimeZone(pts: Pt[], selected: boolean, h: number, s: DrawingStyle): Scene {
  const [a, b] = pts;
  const vert = s.vertLabelsAlign ?? "bottom";
  const horzS = s.horzLabelsAlign ?? "right";
  const horz = horzS === "left" ? "right" : horzS === "right" ? "left" : "center";
  const labelAt = (x: number, coeff: number) =>
    s.showLabels === false ? null : tvTextLayout({ x, y: vert === "top" ? 0 : vert === "middle" ? 0.5 * h : h, text: String(coeff), fs: 12, vert, horz, offsetX: 2 });
  const unit = b.x - a.x;
  const levels = activeLevels(s, FIB_TIMEZONE_LEVEL_DEFAULTS);
  const fillO = levelFillOpacity(s);
  // anchor connector (TV trendline: #808080 dashed 1px)
  const items: SceneItem[] = [{ t: "line", a, b, stroke: "#808080", strokeWidth: 1, dash: "6 4" }];
  if (fillO > 0) {
    levels.slice(1).forEach((hi, i) => {
      const x0 = a.x + unit * levels[i].coeff;
      const x1 = a.x + unit * hi.coeff;
      items.push({ t: "rect", x: Math.min(x0, x1), y: 0, w: Math.max(1, Math.abs(x1 - x0)), h, fill: hi.color, fillOpacity: fillO, stroke: "none", inert: true });
    });
  }
  levels.forEach((lvl, i) => {
    const x = a.x + unit * lvl.coeff;
    const label = labelAt(x, lvl.coeff);
    items.push(...vLevelItems(`l${i}`, lvl, x, h, s, label, label && vert === "middle" && textCrossesLine(label.lines) ? label.poly : null));
  });
  items.push(...anchorsIf(selected, pts));
  return items;
}

const FIB_CIRCLE_LEVELS = [0.236, 0.382, 0.5, 0.618, 1];

/** Fib circles (TV line-tool-fib-circles): axis-aligned ellipses centred on
 *  the p0-p1 midpoint, half-axes 0.5·|dx|·coeff × 0.5·|dy|·coeff, ring
 *  fills, the value label at each ellipse bottom, dashed trend line. */
export function sceneFibCircles(d: Drawing, pts: Pt[], selected: boolean, s: DrawingStyle): Scene {
  const [a, b] = pts;
  if (d.fmt !== 2) {
    // Legacy entries (before 24/09/2026): circles centred on p0, radius |p1 − p0|.
    const r = Math.hypot(b.x - a.x, b.y - a.y);
    const dash = dashFor(s);
    return [
      ...FIB_CIRCLE_LEVELS.map((lvl) => ({ t: "circle" as const, cx: a.x, cy: a.y, r: r * lvl, fill: "none", stroke: s.color, strokeWidth: s.width, dash, strokeOpacity: lvl === 1 ? 1 : 0.55 })),
      { t: "line", a, b, stroke: s.color, strokeWidth: 1, strokeOpacity: 0.4, dash: "2 3" },
      ...anchorsIf(selected, pts),
    ];
  }
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const hx = Math.abs(b.x - a.x) / 2;
  const hy = Math.abs(b.y - a.y) / 2;
  const levels = (s.levels ?? FIB_CIRCLE_LEVEL_DEFAULTS).filter((l) => l.visible);
  const fillO = levelFillOpacity(s);
  const ell = (c: number) => `M ${cx - hx * c} ${cy} a ${hx * c} ${hy * c} 0 1 0 ${2 * hx * c} 0 a ${hx * c} ${hy * c} 0 1 0 ${-2 * hx * c} 0 Z`;
  const items: SceneItem[] = [];
  if (fillO > 0) {
    levels.forEach((lvl, i) => items.push({ t: "path", d: ell(lvl.coeff) + (i > 0 ? " " + ell(levels[i - 1].coeff) : ""), fill: lvl.color, fillOpacity: fillO, fillRule: "evenodd", stroke: "none", inert: true }));
  }
  for (const lvl of levels) {
    // TV: the value label at the ellipse bottom, Left / Middle (box ending
    // 4px before the point); "Levels" / "Coeffs as percents".
    const l = s.showCoeffs !== false ? fibLevelLabel({ text: fibCoeffText(lvl.coeff, !!s.fibLevelsAsPercents), y: cy + hy * lvl.coeff, left: cx, right: cx, extendLeft: false, extendRight: false, paneW: 0, horz: "left", vert: "middle", fs: 12 }) : null;
    items.push({ t: "ellipse", cx, cy, rx: hx * lvl.coeff, ry: hy * lvl.coeff, fill: "none", stroke: lvl.color, strokeWidth: levelWidth(lvl, s), dash: levelDash(lvl, s) });
    if (l) items.push(tvTextItems(l, lvl.color));
  }
  items.push(...fibTrendLineItems(a, b, s), ...anchorsIf(selected, pts));
  return items;
}

/** Fib speed resistance fan (TV): price / time level grid inside the p0-p1
 *  box, coefficient labels per side, rays from p0 through each level
 *  (extended), fills between neighbouring rays in the second ray's colour. */
export function sceneFibSpeedFan(d: Drawing, pts: Pt[], selected: boolean, w: number, h: number, s: DrawingStyle, coords: Coords | null): Scene {
  const [a, b] = pts;
  const g = speedFanGeometry(d, pts, coords, SPEED_FAN_LEVEL_DEFAULTS);
  const dash = dashFor(s);
  const fillO = levelFillOpacity(s);
  const hRays = g.h.map((l) => ({ color: l.color, far: extendRay(a, { x: b.x, y: l.y }, w, h) }));
  const vRays = g.v.map((l) => ({ color: l.color, far: extendRay(a, { x: l.x, y: b.y }, w, h) }));
  const wedges = (rays: { color: string; far: Pt }[]) => rays.slice(1).map((r, i) => ({ color: r.color, pts: [a, r.far, rays[i].far] }));
  const { left, top, right, bottom } = g.box;
  const grid = s.fanGrid ?? SPEED_FAN_GRID_DEFAULT;
  const gridDash = dashFor({ ...s, lineStyle: grid.style, width: grid.width });
  const lab = (x: number, y: number, coeff: number, vert: "top" | "middle" | "bottom", horz: "left" | "center" | "right", ox: number, oy: number) =>
    tvTextLayout({ x, y, text: fmtCoeff(coeff), fs: 12, vert, horz, offsetX: ox, offsetY: oy });
  const items: SceneItem[] = [];
  if (fillO > 0) {
    for (const band of [...wedges(hRays), ...wedges(vRays)]) items.push({ t: "polygon", pts: band.pts, fill: band.color, fillOpacity: fillO, stroke: "none", inert: true });
  }
  for (const l of g.h) {
    if (grid.visible) items.push({ t: "line", a: { x: left, y: l.y }, b: { x: right, y: l.y }, stroke: grid.color, strokeWidth: grid.width, dash: gridDash, inert: true });
    if (s.showLeftLabels !== false) items.push(tvTextItems(lab(left, l.y, l.coeff, "middle", "right", 5, 0), l.color));
    if (s.showRightLabels !== false) items.push(tvTextItems(lab(right, l.y, l.coeff, "middle", "left", 5, 0), l.color));
  }
  for (const l of g.v) {
    if (grid.visible) items.push({ t: "line", a: { x: l.x, y: top }, b: { x: l.x, y: bottom }, stroke: grid.color, strokeWidth: grid.width, dash: gridDash, inert: true });
    if (s.showTopLabels !== false) items.push(tvTextItems(lab(l.x, top, l.coeff, "bottom", "center", 0, 5), l.color));
    if (s.showBottomLabels !== false) items.push(tvTextItems(lab(l.x, bottom, l.coeff, "top", "center", 0, 5), l.color));
  }
  for (const r of [...hRays, ...vRays]) {
    items.push({ t: "hit", a, b: r.far, width: HIT_TOLERANCE * 2 });
    items.push({ t: "line", a, b: r.far, stroke: r.color, strokeWidth: s.width, dash, cap: "round" });
  }
  items.push(...anchorsIf(selected, pts));
  return items;
}

/** Fib speed resistance arcs (TV module 49463): half circles (full circles
 *  with fullCircles) of radius coeff·|p0p1| round p0, bulging toward p1;
 *  fills between arcs; the value label at the arc apex; the trend line. */
export function sceneFibSpeedArcs(pts: Pt[], selected: boolean, s: DrawingStyle): Scene {
  const [c, edge] = pts;
  const unit = Math.hypot(edge.x - c.x, edge.y - c.y);
  const dir = edge.y >= c.y ? 1 : -1;
  const dash = dashFor(s);
  const levels = activeLevels(s, SPEED_ARC_LEVEL_DEFAULTS);
  const fillO = levelFillOpacity(s);
  const full = !!s.fullCircles;
  const arc = (r: number) =>
    full
      ? `M ${c.x - r} ${c.y} A ${r} ${r} 0 1 0 ${c.x + r} ${c.y} A ${r} ${r} 0 1 0 ${c.x - r} ${c.y}`
      : `M ${c.x - r} ${c.y} A ${r} ${r} 0 0 ${dir > 0 ? 0 : 1} ${c.x + r} ${c.y}`;
  const items: SceneItem[] = [];
  if (unit >= 1e-6) {
    if (fillO > 0) {
      levels.slice(1).forEach((hi, i) => {
        const r0 = unit * levels[i].coeff;
        const r1 = unit * hi.coeff;
        // Annulus half: outer arc + inner arc reversed.
        const d = full
          ? `${arc(r1)} Z ${arc(r0)} Z`
          : `M ${c.x - r1} ${c.y} A ${r1} ${r1} 0 0 ${dir > 0 ? 0 : 1} ${c.x + r1} ${c.y} L ${c.x + r0} ${c.y} A ${r0} ${r0} 0 0 ${dir > 0 ? 1 : 0} ${c.x - r0} ${c.y} Z`;
        items.push({ t: "path", d, fill: hi.color, fillOpacity: fillO, fillRule: "evenodd", stroke: "none", inert: true });
      });
    }
    for (const lvl of levels) {
      const r = unit * lvl.coeff;
      items.push({ t: "hitPath", d: arc(r), width: HIT_TOLERANCE * 2 });
      items.push({ t: "path", d: arc(r), fill: "none", stroke: lvl.color, strokeWidth: levelWidth(lvl, s), dash: levelDash(lvl, s) ?? dash });
      if (s.showCoeffs !== false) {
        const l = fibLevelLabel({ text: fibCoeffText(lvl.coeff, false), y: c.y + dir * r, left: c.x, right: c.x, extendLeft: false, extendRight: false, paneW: 0, horz: "left", vert: "middle", fs: 12 });
        if (l) items.push(tvTextItems(l, lvl.color));
      }
    }
    items.push(...fibTrendLineItems(c, edge, s));
  }
  items.push(...anchorsIf(selected, pts));
  return items;
}

/** Fib spiral (TV): radius grows one Fibonacci number per quarter turn,
 *  through p1 after one turn, 2.5 turns; connector p0→p1 extended right. */
export function sceneFibSpiral(pts: Pt[], selected: boolean, w: number, h: number, s: DrawingStyle): Scene {
  const [a, b] = pts;
  const samples = spiralSamples(a, b, !!s.counterclockwise);
  const dash = dashFor(s);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const big = (w + h) * 2;
  const end = { x: b.x + (dx / len) * big, y: b.y + (dy / len) * big };
  return [
    ...(samples.length >= 2
      ? [
          { t: "line" as const, a, b: end, stroke: s.color, strokeWidth: s.width, dash },
          { t: "polyline" as const, pts: samples, fill: "none", stroke: s.color, strokeWidth: s.width, dash, join: "round" as const, cap: "round" as const },
        ]
      : []),
    ...anchorsIf(selected, pts),
  ];
}

/** Fib wedge (TV): p0 = apex, p0→p1 / p0→p2 the edges (the second clamped
 *  to the first's length); level arcs at radius coeff·edge length between
 *  the edge angles, fills between them, the edges as the trend line. */
export function sceneFibWedge(pts: Pt[], selected: boolean, s: DrawingStyle): Scene {
  const [p0, p1, p2raw] = pts;
  const len1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  if (len1 < 1e-6) return anchorsIf(selected, pts);
  const a1 = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  const a2raw = Math.atan2(p2raw.y - p0.y, p2raw.x - p0.x);
  const p2 = { x: p0.x + Math.cos(a2raw) * len1, y: p0.y + Math.sin(a2raw) * len1 };
  let sweep = a2raw - a1;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  while (sweep < -Math.PI) sweep += 2 * Math.PI;
  const dash = dashFor(s);
  const levels = activeLevels(s, FIB_WEDGE_LEVEL_DEFAULTS);
  const fillO = levelFillOpacity(s);
  const SAMPLES = 24;
  const arcPts = (r: number): Pt[] => {
    const out: Pt[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const ang = a1 + (sweep * i) / SAMPLES;
      out.push({ x: p0.x + Math.cos(ang) * r, y: p0.y + Math.sin(ang) * r });
    }
    return out;
  };
  const items: SceneItem[] = [
    { t: "hit", a: p0, b: p1, width: 12 },
    { t: "hit", a: p0, b: p2, width: 12 },
  ];
  if (fillO > 0) {
    levels.slice(1).forEach((hi, i) => {
      const outer = arcPts(len1 * hi.coeff);
      const inner = arcPts(len1 * levels[i].coeff).reverse();
      items.push({ t: "polygon", pts: [...outer, ...inner], fill: hi.color, fillOpacity: fillO, stroke: "none", inert: true });
    });
  }
  // TV fib wedge: the two edges are its "Trend line".
  items.push(...fibTrendLineItems(p0, p1, s, true), ...fibTrendLineItems(p0, p2, s, true));
  for (const lvl of levels) {
    const r = len1 * lvl.coeff;
    const midAng = a1 + sweep / 2;
    items.push({ t: "polyline", pts: arcPts(r), fill: "none", stroke: lvl.color, strokeWidth: levelWidth(lvl, s), dash: levelDash(lvl, s) ?? dash });
    if (s.showCoeffs !== false) {
      items.push({ t: "text", x: p0.x + Math.cos(midAng) * (r + 8), y: p0.y + Math.sin(midAng) * (r + 8), text: fmtCoeff(lvl.coeff), size: 11, fill: lvl.color, anchor: "middle", inert: true });
    }
  }
  items.push(...anchorsIf(selected, pts));
  return items;
}

/** Pitchfan (TV): rays from p0 through the median point and mid ± half·coeff
 *  for each visible level, fills between neighbouring rays. */
export function scenePitchfan(pts: Pt[], selected: boolean, w: number, s: DrawingStyle): Scene {
  const [p0, p1, p2] = pts;
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const half = { x: (p2.x - p1.x) / 2, y: (p2.y - p1.y) / 2 };
  const dash = dashFor(s);
  const levels = activeLevels(s, PITCHFORK_LEVEL_DEFAULTS);
  const fillO = levelFillOpacity(s);
  const big = w * 4;
  const rayEnd = (target: Pt): Pt => {
    const dx = target.x - p0.x;
    const dy = target.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p0.x + (dx / len) * big, y: p0.y + (dy / len) * big };
  };
  // Ordered ray targets: −levels … median … +levels (for the fills).
  const ordered: { t: Pt; color: string; median?: boolean }[] = [
    ...levels.slice().reverse().map((l) => ({ t: { x: mid.x - half.x * l.coeff, y: mid.y - half.y * l.coeff }, color: l.color })),
    { t: mid, color: s.color, median: true },
    ...levels.map((l) => ({ t: { x: mid.x + half.x * l.coeff, y: mid.y + half.y * l.coeff }, color: l.color })),
  ];
  const items: SceneItem[] = [{ t: "line", a: p1, b: p2, stroke: s.color, strokeWidth: s.width, dash }];
  for (const o of ordered) items.push({ t: "hit", a: p0, b: rayEnd(o.t), width: HIT_TOLERANCE * 2 });
  if (fillO > 0) {
    ordered.slice(1).forEach((hi, i) => items.push({ t: "polygon", pts: [p0, rayEnd(ordered[i].t), rayEnd(hi.t)], fill: hi.color, fillOpacity: fillO, stroke: "none", inert: true }));
  }
  for (const o of ordered) items.push({ t: "line", a: p0, b: rayEnd(o.t), stroke: o.color, strokeWidth: o.median ? s.width : 1, dash });
  items.push(...anchorsIf(selected, pts));
  return items;
}
