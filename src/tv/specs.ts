/*
 * Per-kind specs for the SVG overlay: click-count, preview style, and
 * whether the kind uses the bbox-corner-remap drag pattern (rectangle,
 * circle, date-and-price-range) instead of the per-point drag pattern.
 *
 * Full DrawingSpec (defaults/floatingToolbar/settingsTabs) lands later
 * when the SelectedToolbar + SettingsDialog ports happen.
 */
import { DEFAULT_STYLE, type DrawingKind, type DrawingStyle, type GhostCandleStyle, type LevelDef, type RegressionLine, type GannLine, type GannRatioLine } from "./types";

// ── Factory level sets (decompiled from TV's line-tool bundles, 10/07/2026;
//    colours re-checked live on TV 3.4.1 with properties().factoryDefaults(),
//    24/09/2026 — research/drawings-gap/data/levels-compare.txt:
//    line-tool-fib-retracement / line-tool-pitchfork / line-tool-gann-fan
//    `_createWithDefaults` tables — coeffs, visibility and per-level palette
//    colours are verbatim). Shared TV palette tokens:
const GRAY = "#808080";   // grey (TV 3.4.1 factory; was cold-gray-500 #787b86)
const RED = "#f23645";    // ripe-red-500
const ORANGE = "#ff9800"; // tan-orange-500
const GREEN = "#4caf50";  // iguana-green-500
const MINTY = "#089981";  // minty-green-500
const SKY = "#00bcd4";    // cyan (TV 3.4.1 factory "sky" level colour; was #2196f3)
const BLUE = "#2962ff";   // tv-blue-500
const PURPLE = "#9c27b0"; // grapes-purple-500
const PINK = "#e91e63";   // berry-pink-500
const DEEP_PURPLE = "#673ab7"; // deep-purple (TV patterns, double curve)

/** TV's 24-level fib set (retracement / trend-based extension / channel).
 *  Default-visible: 0…1 plus the 1.618/2.618/3.618/4.236 extensions. */
// TV factory order (level1..level24: the visible levels first, then the
// hidden ones); the renderers sort by coefficient.
export const FIB_LEVEL_DEFAULTS: LevelDef[] = [
  { coeff: 0, color: GRAY, visible: true },
  { coeff: 0.236, color: RED, visible: true },
  { coeff: 0.382, color: ORANGE, visible: true },
  { coeff: 0.5, color: GREEN, visible: true },
  { coeff: 0.618, color: MINTY, visible: true },
  { coeff: 0.786, color: SKY, visible: true },
  { coeff: 1, color: GRAY, visible: true },
  { coeff: 1.618, color: BLUE, visible: true },
  { coeff: 2.618, color: RED, visible: true },
  { coeff: 3.618, color: PURPLE, visible: true },
  { coeff: 4.236, color: PINK, visible: true },
  { coeff: 1.272, color: ORANGE, visible: false },
  { coeff: 1.414, color: RED, visible: false },
  { coeff: 2.272, color: ORANGE, visible: false },
  { coeff: 2.414, color: GREEN, visible: false },
  { coeff: 2, color: MINTY, visible: false },
  { coeff: 3, color: SKY, visible: false },
  { coeff: 3.272, color: GRAY, visible: false },
  { coeff: 3.414, color: BLUE, visible: false },
  { coeff: 4, color: RED, visible: false },
  { coeff: 4.272, color: PURPLE, visible: false },
  { coeff: 4.414, color: PINK, visible: false },
  { coeff: 4.618, color: ORANGE, visible: false },
  { coeff: 4.764, color: MINTY, visible: false },
];

/** Pitchfork family: 9 levels, default-visible .5 and 1 (the tines). The
 *  median is drawn in the drawing's base colour (TV default ripe-red). */
export const PITCHFORK_LEVEL_DEFAULTS: LevelDef[] = [
  { coeff: 0.25, color: "#ffb74d", visible: false }, // tan-orange-300
  { coeff: 0.382, color: "#81c784", visible: false }, // iguana-green-300
  { coeff: 0.5, color: MINTY, visible: true },
  { coeff: 0.618, color: MINTY, visible: false },
  { coeff: 0.75, color: SKY, visible: false },
  { coeff: 1, color: BLUE, visible: true },
  { coeff: 1.5, color: PURPLE, visible: false },
  { coeff: 1.75, color: PINK, visible: false },
  { coeff: 2, color: "#f77c80", visible: false }, // ripe-red-300
];

/** Gann fan: coeff = time-fraction of the 1/1 ray (1/8 is the steepest —
 *  it reaches the anchor move's dy in an eighth of the dt). All visible. */
export const GANN_FAN_LEVEL_DEFAULTS: LevelDef[] = [
  { coeff: 1 / 8, color: ORANGE, visible: true, label: "1/8" },
  { coeff: 1 / 4, color: MINTY, visible: true, label: "1/4" },
  { coeff: 1 / 3, color: GREEN, visible: true, label: "1/3" },
  { coeff: 1 / 2, color: MINTY, visible: true, label: "1/2" },
  { coeff: 1, color: SKY, visible: true, label: "1/1" },
  { coeff: 2, color: BLUE, visible: true, label: "2/1" },
  { coeff: 3, color: PURPLE, visible: true, label: "3/1" },
  { coeff: 4, color: PINK, visible: true, label: "4/1" },
  { coeff: 8, color: RED, visible: true, label: "8/1" },
];

/** Fib wedge: 11 levels, .236…1 visible by default (the coeff-1 pair are the
 *  wedge edges); extensions hidden. */
export const FIB_WEDGE_LEVEL_DEFAULTS: LevelDef[] = [
  { coeff: 0.236, color: RED, visible: true },
  { coeff: 0.382, color: ORANGE, visible: true },
  { coeff: 0.5, color: GREEN, visible: true },
  { coeff: 0.618, color: MINTY, visible: true },
  { coeff: 0.786, color: SKY, visible: true },
  { coeff: 1, color: GRAY, visible: true },
  { coeff: 1.618, color: BLUE, visible: false },
  { coeff: 2.618, color: RED, visible: false },
  { coeff: 3.618, color: DEEP_PURPLE, visible: false },
  { coeff: 4.236, color: PINK, visible: false },
  { coeff: 4.618, color: PINK, visible: false },
];

/** Speed-resistance fan: one ladder applied to BOTH the price and time axes.
 *  TV keeps separate hlevel/vlevel lists; both factory lists are 0 · 0.25 ·
 *  0.382 · 0.5 · 0.618 · 0.75 · 1 with these colours (0 and 1 = the box edges). */
export const SPEED_FAN_LEVEL_DEFAULTS: LevelDef[] = [
  { coeff: 0, color: GRAY, visible: true },
  { coeff: 0.25, color: ORANGE, visible: true },
  { coeff: 0.382, color: SKY, visible: true },
  { coeff: 0.5, color: GREEN, visible: true },
  { coeff: 0.618, color: MINTY, visible: true },
  { coeff: 0.75, color: BLUE, visible: true },
  { coeff: 1, color: GRAY, visible: true },
];

/** Trend-based fib time (TV factory, read live 25/09/2026): 11 levels, 2px
 *  solid, 0.5 hidden; dashed #808080 2px trend lines. */
export const TREND_FIB_TIME_LEVEL_DEFAULTS: LevelDef[] = [
  { coeff: 0, color: GRAY, visible: true, width: 2, style: "solid" },
  { coeff: 0.382, color: RED, visible: true, width: 2, style: "solid" },
  { coeff: 0.5, color: "#81c784", visible: false, width: 2, style: "solid" },
  { coeff: 0.618, color: GREEN, visible: true, width: 2, style: "solid" },
  { coeff: 1, color: MINTY, visible: true, width: 2, style: "solid" },
  { coeff: 1.382, color: SKY, visible: true, width: 2, style: "solid" },
  { coeff: 1.618, color: GRAY, visible: true, width: 2, style: "solid" },
  { coeff: 2, color: BLUE, visible: true, width: 2, style: "solid" },
  { coeff: 2.382, color: PINK, visible: true, width: 2, style: "solid" },
  { coeff: 2.618, color: PURPLE, visible: true, width: 2, style: "solid" },
  { coeff: 3, color: "#673ab7", visible: true, width: 2, style: "solid" },
];
export const TREND_FIB_TIME_TREND_DEFAULT = { visible: true, color: GRAY, width: 2, style: "dashed" as const };
/** TV fib "Trend line" factory: retracement / extension / circles / arcs
 *  dashed #808080 2px; fib wedge solid. */
export const FIB_TREND_LINE_DEFAULT = TREND_FIB_TIME_TREND_DEFAULT;
export const FIB_WEDGE_TREND_LINE_DEFAULT = { visible: true, color: GRAY, width: 2, style: "solid" as const };

/** Gann square / fixed (TV module 135885): 6 levels, 11 fans (2x1, 1x1, 1x2
 *  on), 11 arcs (all on), 2px. */
const gl = (color: string, visible: boolean): GannLine => ({ color, width: 2, visible });
const gr = (color: string, visible: boolean, x: number, y: number): GannRatioLine => ({ color, width: 2, visible, x, y });
export const GANN_LEVEL_DEFAULTS: GannLine[] = [gl(GRAY, true), gl(ORANGE, true), gl(SKY, true), gl(GREEN, true), gl(MINTY, true), gl(GRAY, true)];
export const GANN_FAN_DEFAULTS: GannRatioLine[] = [
  gr("#b39ddb", false, 8, 1), gr(RED, false, 5, 1), gr(GRAY, false, 4, 1), gr(ORANGE, false, 3, 1), gr(SKY, true, 2, 1),
  gr(GREEN, true, 1, 1), gr(MINTY, true, 1, 2), gr(MINTY, false, 1, 3), gr(BLUE, false, 1, 4), gr("#9575cd", false, 1, 5), gr("#b39ddb", false, 1, 8),
];
export const GANN_ARC_DEFAULTS: GannRatioLine[] = [
  gr(ORANGE, true, 1, 0), gr(ORANGE, true, 1, 1), gr(ORANGE, true, 1.5, 0), gr(SKY, true, 2, 0), gr(SKY, true, 2, 1),
  gr(GREEN, true, 3, 0), gr(GREEN, true, 3, 1), gr(MINTY, true, 4, 0), gr(MINTY, true, 4, 1), gr(BLUE, true, 5, 0), gr(BLUE, true, 5, 1),
];

/** Fib speed resistance fan grid (TV factory, read live 25/09/2026). */
export const SPEED_FAN_GRID_DEFAULT = { visible: true, color: "rgba(21, 56, 153, 0.8)", width: 1, style: "solid" as const };

/** Fib time zone (line-tool-fib-timezone `_createWithDefaults`): 11 levels at
 *  the Fibonacci sequence, level 1 cold-gray and the rest tv-blue, all
 *  visible. Rendered as vertical lines spaced by the p0→p1 bar distance. */
export const FIB_TIMEZONE_LEVEL_DEFAULTS: LevelDef[] = [
  { coeff: 0, color: GRAY, visible: true },
  { coeff: 1, color: BLUE, visible: true },
  { coeff: 2, color: BLUE, visible: true },
  { coeff: 3, color: BLUE, visible: true },
  { coeff: 5, color: BLUE, visible: true },
  { coeff: 8, color: BLUE, visible: true },
  { coeff: 13, color: BLUE, visible: true },
  { coeff: 21, color: BLUE, visible: true },
  { coeff: 34, color: BLUE, visible: true },
  { coeff: 55, color: BLUE, visible: true },
  { coeff: 89, color: BLUE, visible: true },
];

/** Anchored VWAP ±σ bands (line-tool-anchored-vwap: UpperBand/LowerBand #1..#3
 *  style pairs + per-band multiplier inputs; the study ships them hidden so a
 *  fresh tool draws only the VWAP line). coeff = the band's σ multiplier. The
 *  study's factory palette lives in the server metaInfo (not in the captured
 *  chunk) — the public VWAP study's green/olive/teal set is used. */
export const VWAP_BAND_DEFAULTS: LevelDef[] = [
  // TV anchoredvwap factory: band #1 on (calculate_stDev), #2 / #3 off.
  { coeff: 1, color: GREEN, visible: true },
  { coeff: 2, color: "#808000", visible: false },
  { coeff: 3, color: "#00897b", visible: false },
];

/** Anchored VWAP band lines (TV styles UpperBand / LowerBand #1..#3
 *  factory: visible, #4caf50 / #808000 / #00897b, 1px, solid). */
export const VWAP_BAND_LINE_DEFAULTS: RegressionLine[] = [
  { visible: true, color: GREEN, width: 1, style: "solid" },
  { visible: true, color: "#808000", width: 1, style: "solid" },
  { visible: true, color: "#00897b", width: 1, style: "solid" },
];

/** Speed-resistance arcs: TV factory, 11 levels, all visible. */
export const SPEED_ARC_LEVEL_DEFAULTS: LevelDef[] = [
  { coeff: 0.236, color: RED, visible: true },
  { coeff: 0.382, color: ORANGE, visible: true },
  { coeff: 0.5, color: MINTY, visible: true },
  { coeff: 0.618, color: GREEN, visible: true },
  { coeff: 0.786, color: SKY, visible: true },
  { coeff: 1, color: GRAY, visible: true },
  { coeff: 1.618, color: BLUE, visible: true },
  { coeff: 2.618, color: PINK, visible: true },
  { coeff: 3.618, color: BLUE, visible: true },
  { coeff: 4.236, color: PINK, visible: true },
  { coeff: 4.618, color: RED, visible: true },
];

/** Fib circles (TV line-tool-fib-circles factory): 11 levels, all visible. */
export const FIB_CIRCLE_LEVEL_DEFAULTS: LevelDef[] = [
  { coeff: 0.236, color: RED, visible: true },
  { coeff: 0.382, color: ORANGE, visible: true },
  { coeff: 0.5, color: MINTY, visible: true },
  { coeff: 0.618, color: GREEN, visible: true },
  { coeff: 0.786, color: SKY, visible: true },
  { coeff: 1, color: GRAY, visible: true },
  { coeff: 1.618, color: BLUE, visible: true },
  { coeff: 2.618, color: PINK, visible: true },
  { coeff: 3.618, color: BLUE, visible: true },
  { coeff: 4.236, color: PINK, visible: true },
  { coeff: 4.618, color: RED, visible: true },
];

/** Gann box (TV gannbox factory): hlevel1..7 and vlevel1..7 are the same
 *  ladder, all visible; one list drives both axes here. */
export const GANN_BOX_LEVEL_DEFAULTS: LevelDef[] = [
  { coeff: 0, color: GRAY, visible: true },
  { coeff: 0.25, color: ORANGE, visible: true },
  { coeff: 0.382, color: SKY, visible: true },
  { coeff: 0.5, color: GREEN, visible: true },
  { coeff: 0.618, color: MINTY, visible: true },
  { coeff: 0.75, color: BLUE, visible: true },
  { coeff: 1, color: GRAY, visible: true },
];

/** Elliott wave degrees (TV LineToolElliottDegree, value = index; English
 *  titles from the TV translations) and the factory degree (Intermediate). */
export const ELLIOTT_DEGREE_NAMES = [
  "Supermillennium", "Millennium", "Submillennium", "Grand supercycle", "Supercycle",
  "Cycle", "Primary", "Intermediate", "Minor", "Minute", "Minuette", "Subminuette",
  "Micro", "Submicro", "Minuscule",
] as const;
export const ELLIOTT_DEFAULT_DEGREE = 7;
export const ELLIOTT_KINDS = new Set<string>(["elliott-impulse", "elliott-correction", "elliott-triangle", "elliott-double-combo", "elliott-triple-combo"]);

/** Ghost feed candle style (TV factory: minty-green-100 / ripe-red-200
 *  bodies, minty-green-500 / ripe-red-500 borders, cold-gray-500 wick). */
export const GHOST_CANDLE_DEFAULTS: GhostCandleStyle = {
  upColor: "#ACE5DC",
  downColor: "#FAA1A4",
  drawBorder: true,
  borderUpColor: "#089981",
  borderDownColor: "#F23645",
  drawWick: true,
  wickColor: "#808080",
};

/** Regression trend line styles (TV linreg study factory: upLine / downLine
 *  rgba(41,98,255,0.3) 2px solid, baseLine rgba(242,54,69,0.3) 1px dashed;
 *  TV draws the lines opaque and the fills at the style transparency). */
export const REGRESSION_LINE_DEFAULTS: { base: RegressionLine; up: RegressionLine; down: RegressionLine } = {
  base: { visible: true, color: RED, width: 1, style: "dashed" },
  up: { visible: true, color: BLUE, width: 2, style: "solid" },
  down: { visible: true, color: BLUE, width: 2, style: "solid" },
};

/** Parallel channel (TV line-tool-parallel-channel v2): 7 levels, coeff =
 *  share of the p0 -> p2 offset; 0 / 0.5 / 1 visible, 0 and 1 solid 2px,
 *  0.5 dashed 1px, all tv-blue-500. */
export const PARALLEL_CHANNEL_LEVEL_DEFAULTS: LevelDef[] = [-0.25, 0, 0.25, 0.5, 0.75, 1, 1.25].map((coeff, i) => ({
  coeff,
  color: BLUE,
  visible: i === 1 || i === 3 || i === 5,
  width: i === 1 || i === 5 ? 2 : 1,
  style: i === 3 ? "dashed" : "solid",
}));

/** Pitchfan: the pitchfork ladder, except the visible 0.5 ray is cyan. */
export const PITCHFAN_LEVEL_DEFAULTS: LevelDef[] = PITCHFORK_LEVEL_DEFAULTS.map((l) =>
  l.coeff === 0.5 ? { ...l, color: SKY } : l,
);

export type PreviewKind = "none" | "line" | "rect";

export type OverlaySpec = {
  kind: DrawingKind;
  /** Clicks needed to place the drawing. 1–3 for the geometric kinds; 4 for
   *  double-curve; 3–7 for the pattern/Elliott polylines. */
  pointCount: number;
  /** Rubber-band shown while placing. 1-point and 3-point kinds use
   *  "none"; trend-line / arrow use "line"; all bbox kinds use "rect". */
  preview: PreviewKind;
  /** Bbox-style 4-handle remap on drag (otherwise per-point drag). */
  isBbox: boolean;
  /** Freehand tools (path/polyline/brush/highlighter): clicks keep appending
   *  vertices and the user double-clicks to finalize, rather than auto-
   *  finalizing once `pointCount` points are placed. `pointCount` is the
   *  minimum needed to commit. */
  variableLength?: boolean;
  /** Freehand tools (brush/highlighter): the path is drawn while the mouse
   *  button is held — sampled from pointer-move and committed on button-up —
   *  rather than placed point-by-point. (TV's `isLineDrawnWithPressedButton`;
   *  source of truth: tradingview-agent docs/drawing_placement.md §1.) */
  freehand?: boolean;
  /** Text-family kinds: opens the inline text editor on placement and on
   *  double-click, writing the typed string to the drawing's `text` field. */
  textEditable?: boolean;
  hotkey?: string;
  /** Per-tool style overrides on top of DEFAULT_STYLE, applied at creation and
   *  in the placement preview (see `defaultStyleFor`). Mirrors the mock's
   *  per-spec `defaults`. Values sourced from the TradingView factory defaults
   *  captured in tradingview-agent (docs/drawing_tools.md). Tools without an
   *  entry use DEFAULT_STYLE unchanged. */
  defaults?: Partial<DrawingStyle>;
};

export const OVERLAY_SPECS: Record<DrawingKind, OverlaySpec> = {
  // 1-point
  "horizontal-line": { kind: "horizontal-line", pointCount: 1, preview: "none", isBbox: false, hotkey: "Alt + H", defaults: { width: 2, textColor: "#2962ff", showPriceLabels: true } },
  "horizontal-ray": { kind: "horizontal-ray", pointCount: 1, preview: "none", isBbox: false, hotkey: "Alt + J", defaults: { width: 2, showPriceLabels: true } },
  "vertical-line": { kind: "vertical-line", pointCount: 1, preview: "none", isBbox: false, hotkey: "Alt + V", defaults: { width: 2, textColor: "#2962ff", showTime: true } },
  "cross-line": { kind: "cross-line", pointCount: 1, preview: "none", isBbox: false, hotkey: "Alt + C", defaults: { width: 2, textColor: "#ffffff", showPriceLabels: true, showTime: true } },
  // TV factory (line-tool-arrow-marker): tv-blue-600 body + text, 16px bold.
  "arrow-marker": { kind: "arrow-marker", pointCount: 2, preview: "line", isBbox: false, defaults: { color: "#1e53e5", width: 2, textColor: "#1e53e5", fontSize: 16, bold: true } },
  // TV arrow marks: arrowColor = text colour, font 14 (minty-green-500 up,
  // ripe-red-600 down).
  "arrow-mark-up": { kind: "arrow-mark-up", pointCount: 1, preview: "none", isBbox: false, defaults: { color: "#089981", fontSize: 14 } },
  "arrow-mark-down": { kind: "arrow-mark-down", pointCount: 1, preview: "none", isBbox: false, defaults: { color: "#cc2f3c", fontSize: 14 } },
  // TV price label factory: bold 14px white on tv-blue-500, border
  // tv-blue-500, transparency 0.
  "price-label": { kind: "price-label", pointCount: 1, preview: "none", isBbox: false, defaults: { color: BLUE, textColor: "#ffffff", fontSize: 14, backgroundColor: BLUE, borderColor: BLUE, transparency: 0 } },
  // flag marker (single anchor; the flag flies above the point)
  "flag-mark": { kind: "flag-mark", pointCount: 1, preview: "none", isBbox: false, defaults: { color: "#2962ff" } },
  // 2-point
  "trend-line": { kind: "trend-line", pointCount: 2, preview: "line", isBbox: false, hotkey: "Alt + T", defaults: { width: 2, textColor: "#2962ff", fontSize: 14, horzLabelsAlign: "center", vertLabelsAlign: "bottom" } },
  ray: { kind: "ray", pointCount: 2, preview: "line", isBbox: false, defaults: { width: 2, textColor: "#2962ff", fontSize: 14, horzLabelsAlign: "center", vertLabelsAlign: "bottom", extendRight: true } },
  "extended-line": { kind: "extended-line", pointCount: 2, preview: "line", isBbox: false, defaults: { width: 2, textColor: "#2962ff", fontSize: 14, horzLabelsAlign: "center", vertLabelsAlign: "bottom", extendLeft: true, extendRight: true } },
  "info-line": {
    kind: "info-line", pointCount: 2, preview: "line", isBbox: false,
    // Info line's identity: the stats badge with every granular row on.
    defaults: {
      width: 2, textColor: "#2962ff", fontSize: 14, horzLabelsAlign: "center", vertLabelsAlign: "bottom",
      showStats: true,
      showPriceRange: true, showPercentPriceRange: true, showPipsPriceRange: true,
      showBarsRange: true, showDateTimeRange: true, showDistance: true, showAngle: true,
    },
  },
  "trend-angle": {
    kind: "trend-angle", pointCount: 2, preview: "line", isBbox: false,
    defaults: { width: 2, fontSize: 12 },
  },
  // TV risk / reward factory style: lines #808080 1px, text white 12px,
  // stop #F23645 / target #089981 at 80 transparency, price labels on.
  "long-position": { kind: "long-position", pointCount: 1, preview: "none", isBbox: false, defaults: { color: GRAY, width: 1, textColor: "#ffffff", fontSize: 12, stopColor: "#f23645", stopTransparency: 80, targetColor: "#089981", targetTransparency: 80, showPriceLabels: true, accountSize: 1000, riskPercent: 25, lotSize: 1, riskDisplayMode: "percents", leverage: 10000, qtyPrecision: "default" } },
  "short-position": { kind: "short-position", pointCount: 1, preview: "none", isBbox: false, defaults: { color: GRAY, width: 1, textColor: "#ffffff", fontSize: 12, stopColor: "#f23645", stopTransparency: 80, targetColor: "#089981", targetTransparency: 80, showPriceLabels: true, accountSize: 1000, riskPercent: 25, lotSize: 1, riskDisplayMode: "percents", leverage: 10000, qtyPrecision: "default" } },
  "gann-fan": { kind: "gann-fan", pointCount: 2, preview: "line", isBbox: false, defaults: { width: 2, levels: GANN_FAN_LEVEL_DEFAULTS, fillBackground: true, transparency: 80 } },
  // TV factory (line-tool-gann-box): price and time levels alike, all four
  // label sides on, both backgrounds on at 80, angles off (#9C9C9C).
  "gann-box": { kind: "gann-box", pointCount: 2, preview: "rect", isBbox: true, defaults: { color: "rgba(21, 56, 153, 0.8)", width: 2, lineStyle: "solid", levels: GANN_BOX_LEVEL_DEFAULTS, vLevels: GANN_BOX_LEVEL_DEFAULTS, showLeftLabels: true, showRightLabels: true, showTopLabels: true, showBottomLabels: true, fillBackground: true, transparency: 80, fillVertBackground: true, vertTransparency: 80, fans: { visible: false, color: "#9C9C9C" }, reverse: false } },
  // TV factory: fills default OFF (unlike the retracement family).
  // TV fib time zone labels: on, right / bottom.
  "fib-time-zone": { kind: "fib-time-zone", pointCount: 2, preview: "line", isBbox: false, defaults: { width: 2, levels: FIB_TIMEZONE_LEVEL_DEFAULTS, fillBackground: false, transparency: 80, showLabels: true, horzLabelsAlign: "right", vertLabelsAlign: "bottom" } },
  "fib-circles": { kind: "fib-circles", pointCount: 2, preview: "line", isBbox: false, defaults: { color: GRAY, width: 2, levels: FIB_CIRCLE_LEVEL_DEFAULTS, fillBackground: true, transparency: 80 } },
  "fib-speed-resistance-fan": { kind: "fib-speed-resistance-fan", pointCount: 2, preview: "line", isBbox: false, defaults: { width: 2, levels: SPEED_FAN_LEVEL_DEFAULTS, vLevels: SPEED_FAN_LEVEL_DEFAULTS, fillBackground: true, transparency: 80, showLeftLabels: true, showRightLabels: true, showTopLabels: true, showBottomLabels: true, reverse: false, fanGrid: SPEED_FAN_GRID_DEFAULT } },
  "fib-speed-resistance-arcs": { kind: "fib-speed-resistance-arcs", pointCount: 2, preview: "line", isBbox: false, defaults: { width: 2, levels: SPEED_ARC_LEVEL_DEFAULTS, fillBackground: true, transparency: 80 } },
  // TV factory (line-tool-fib-spiral): sky-blue, 2px.
  "fib-spiral": { kind: "fib-spiral", pointCount: 2, preview: "line", isBbox: false, defaults: { color: SKY, width: 2 } },
  // TV trend-based fib time (3 clicks), Gann square fixed / Gann square (2
  // clicks), Sector = TV projection (3 clicks, wedge model, one level).
  "trend-based-fib-time": { kind: "trend-based-fib-time", pointCount: 3, preview: "line", isBbox: false, defaults: { width: 2, levels: TREND_FIB_TIME_LEVEL_DEFAULTS, fibTrendLine: TREND_FIB_TIME_TREND_DEFAULT, fillBackground: true, transparency: 80, showLabels: true, horzLabelsAlign: "right", vertLabelsAlign: "bottom" } },
  "gann-square-fixed": { kind: "gann-square-fixed", pointCount: 2, preview: "line", isBbox: false, defaults: { width: 2, gannLevels: GANN_LEVEL_DEFAULTS, gannFans: GANN_FAN_DEFAULTS, gannArcs: GANN_ARC_DEFAULTS, fillBackground: true, transparency: 80, reverse: false } },
  "gann-square": { kind: "gann-square", pointCount: 2, preview: "line", isBbox: false, defaults: { width: 2, gannLevels: GANN_LEVEL_DEFAULTS, gannFans: GANN_FAN_DEFAULTS, gannArcs: GANN_ARC_DEFAULTS, fillBackground: true, transparency: 80, reverse: false, showLabels: true, labelFontSize: 12 } },
  sector: { kind: "sector", pointCount: 3, preview: "line", isBbox: false, defaults: { color: "#9c9c9c", width: 2, fillBackground: true, transparency: 80, sectorColor1: BLUE, sectorColor2: PURPLE } },
  "fib-wedge": { kind: "fib-wedge", pointCount: 3, preview: "line", isBbox: false, defaults: { width: 2, levels: FIB_WEDGE_LEVEL_DEFAULTS, fillBackground: true, transparency: 80 } },
  pitchfan: { kind: "pitchfan", pointCount: 3, preview: "line", isBbox: false, defaults: { color: "#f23645", width: 2, levels: PITCHFAN_LEVEL_DEFAULTS, fillBackground: true, transparency: 80 } },
  // TV factories: cyclic #80ccdb 2px; sine #159980 1px; time-cycles #159980
  // with the iguana-green fill on by default.
  "cyclic-lines": { kind: "cyclic-lines", pointCount: 2, preview: "line", isBbox: false, defaults: { color: "#80ccdb", width: 2 } },
  "sine-line": { kind: "sine-line", pointCount: 2, preview: "line", isBbox: false, defaults: { color: "#159980", width: 2 } },
  "time-cycles": { kind: "time-cycles", pointCount: 2, preview: "line", isBbox: false, defaults: { color: "#159980", width: 2, fillBackground: true, backgroundColor: "#6aa84f", transparency: 50 } },
  "fib-retracement": { kind: "fib-retracement", pointCount: 2, preview: "line", isBbox: false, hotkey: "Alt + F", defaults: { width: 2, levels: FIB_LEVEL_DEFAULTS, fillBackground: true, transparency: 80 } },
  // TV arrow factory text: #2962FF, 14px, centre / bottom.
  // TV LineToolArrow: the trend line with rightEnd = Arrow.
  arrow: { kind: "arrow", pointCount: 2, preview: "line", isBbox: false, defaults: { width: 2, textColor: BLUE, fontSize: 14, horzLabelsAlign: "center", vertLabelsAlign: "bottom", leftEnd: 0, rightEnd: 1 } },
  rectangle: { kind: "rectangle", pointCount: 2, preview: "rect", isBbox: true, hotkey: "Alt + Shift + R", defaults: { color: "#9c27b0", width: 2, fillBackground: true, backgroundColor: "#9c27b0", transparency: 50, rectMiddleLine: { visible: false, color: "#9c27b0", width: 1, style: "dashed" } } },
  // TV model: p0 = center, p1 = radius point (radius = their SCREEN distance).
  circle: { kind: "circle", pointCount: 2, preview: "line", isBbox: false, defaults: { width: 2, color: "#ff9800", fillBackground: true, backgroundColor: "#ff9800", transparency: 80 } },
  ellipse: { kind: "ellipse", pointCount: 3, preview: "line", isBbox: false, defaults: { width: 2, color: "#f23645", fillBackground: true, backgroundColor: "#f23645", transparency: 50 } },
  "price-range": { kind: "price-range", pointCount: 2, preview: "rect", isBbox: false, defaults: { width: 2, color: BLUE, fillBackground: true, backgroundColor: BLUE, transparency: 85, textColor: "#ffffff", fontSize: 12 , customTextColor: BLUE, customTextSize: 12 } },
  "date-range": { kind: "date-range", pointCount: 2, preview: "rect", isBbox: false, defaults: { width: 2, color: BLUE, fillBackground: true, backgroundColor: BLUE, transparency: 85, textColor: "#ffffff", fontSize: 12 , customTextColor: BLUE, customTextSize: 12 } },
  "date-and-price-range": { kind: "date-and-price-range", pointCount: 2, preview: "rect", isBbox: false, defaults: { width: 2, color: BLUE, fillBackground: true, backgroundColor: BLUE, transparency: 85, textColor: "#ffffff", fontSize: 12 , customTextColor: BLUE, customTextSize: 12 } },
  // forecast: p0 = entry, p1 = target (vector + success/failure zones)
  // TV factory (line-tool-prediction): tv-blue-500 line and balloons, white
  // texts, iguana-green / ripe-red status banners, transparency 10.
  "position-forecast": { kind: "position-forecast", pointCount: 2, preview: "line", isBbox: false, defaults: { width: 2, color: "#2962FF", transparency: 10, sourceTextColor: "#ffffff", sourceBackColor: "#2962FF", sourceStrokeColor: "#2962FF", targetTextColor: "#ffffff", targetBackColor: "#2962FF", targetStrokeColor: "#2962FF", successTextColor: "#ffffff", successBackground: "#4caf50", failureTextColor: "#ffffff", failureBackground: "#F23645" } },
  // data-driven bbox kinds (sampled / synthesised candles inside the box)
  "bar-pattern": { kind: "bar-pattern", pointCount: 2, preview: "rect", isBbox: true },
  // TV factory (line-tool-ghost-feed): variance 50. Variable-length (TV
  // pointsCount −1): every click after the first adds another drift segment;
  // finished like the polylines (re-click the last vertex / double-click).
  "ghost-feed": { kind: "ghost-feed", pointCount: 2, preview: "line", isBbox: false, variableLength: true, defaults: { variance: 50, transparency: 50 } },
  // 3-point
  triangle: { kind: "triangle", pointCount: 3, preview: "none", isBbox: false, defaults: { width: 2, color: "#089981", fillBackground: true, backgroundColor: "#089981", transparency: 80 } },
  // TV label factory: labelTextColor tv-blue-500, 14px, left, bottom.
  "parallel-channel": { kind: "parallel-channel", pointCount: 3, preview: "line", isBbox: false, defaults: { width: 2, levels: PARALLEL_CHANNEL_LEVEL_DEFAULTS, fillBackground: true, transparency: 80, textColor: BLUE, fontSize: 14, horzLabelsAlign: "left", vertLabelsAlign: "bottom" } },
  pitchfork: { kind: "pitchfork", pointCount: 3, preview: "line", isBbox: false, defaults: { color: "#f23645", width: 2, levels: PITCHFORK_LEVEL_DEFAULTS, fillBackground: true, transparency: 80 } },
  "trend-based-fib-extension": { kind: "trend-based-fib-extension", pointCount: 3, preview: "line", isBbox: false, defaults: { width: 2, levels: FIB_LEVEL_DEFAULTS, fillBackground: true, transparency: 80 } },
  // TV label factory: labelTextColor = the line colour, 14px, left, bottom.
  // TV factory: fill in the line colour at 0.2, prices off (12px, line
  // colour), no line ends, no extend.
  "disjoint-channel": { kind: "disjoint-channel", pointCount: 3, preview: "line", isBbox: false, defaults: { color: "#089981", width: 2, fillBackground: true, backgroundColor: "#089981", transparency: 80, textColor: "#089981", fontSize: 14, horzLabelsAlign: "left", vertLabelsAlign: "bottom", showPrices: false, priceLabelTextColor: "#089981", priceLabelFontSize: 12, leftEnd: 0, rightEnd: 0 } },
  "flat-top-bottom": { kind: "flat-top-bottom", pointCount: 3, preview: "line", isBbox: false, defaults: { color: "#ff9800", width: 2, fillBackground: true, backgroundColor: "#ff9800", transparency: 80, textColor: "#ff9800", fontSize: 14, horzLabelsAlign: "left", vertLabelsAlign: "bottom", showPrices: false, priceLabelTextColor: "#ff9800", priceLabelFontSize: 12, leftEnd: 0, rightEnd: 0 } },
  "schiff-pitchfork": { kind: "schiff-pitchfork", pointCount: 3, preview: "line", isBbox: false, defaults: { color: "#f23645", width: 2, levels: PITCHFORK_LEVEL_DEFAULTS, fillBackground: true, transparency: 80 } },
  "modified-schiff-pitchfork": { kind: "modified-schiff-pitchfork", pointCount: 3, preview: "line", isBbox: false, defaults: { color: "#f23645", width: 2, levels: PITCHFORK_LEVEL_DEFAULTS, fillBackground: true, transparency: 80 } },
  "inside-pitchfork": { kind: "inside-pitchfork", pointCount: 3, preview: "line", isBbox: false, defaults: { color: "#f23645", width: 2, levels: PITCHFORK_LEVEL_DEFAULTS, fillBackground: true, transparency: 80 } },
  "fib-channel": { kind: "fib-channel", pointCount: 3, preview: "line", isBbox: false, defaults: { width: 2, levels: FIB_LEVEL_DEFAULTS, fillBackground: true, transparency: 80, showPrices: true, showCoeffs: true, fibLevelsAsPercents: false, labelFontSize: 12, horzLabelsAlign: "left", vertLabelsAlign: "middle" } },
  "rotated-rectangle": { kind: "rotated-rectangle", pointCount: 3, preview: "line", isBbox: false, defaults: { color: "#4caf50", width: 2, fillBackground: true, backgroundColor: "#4caf50", transparency: 50 } },
  // TV bezier factory: fill off by default, tv-blue back @ 50.
  curve: { kind: "curve", pointCount: 2, preview: "line", isBbox: false, defaults: { width: 2, fillBackground: false, backgroundColor: "#2962ff", transparency: 50 } },
  // TV model: p0/p1 = chord ends, p2 = bulge; a 60° circular cap scaled to the
  // bulge height, filled to the chord (berry-pink alpha20 factory defaults).
  arc: { kind: "arc", pointCount: 3, preview: "line", isBbox: false, defaults: { width: 2, color: "#e91e63", fillBackground: true, backgroundColor: "#e91e63", transparency: 80 } },
  // 4-point
  "double-curve": { kind: "double-curve", pointCount: 2, preview: "line", isBbox: false, defaults: { color: DEEP_PURPLE, width: 2, fillBackground: false, backgroundColor: DEEP_PURPLE, transparency: 80 } },
  // N-point pattern / Elliott family (labeled polylines/polygons).
  // TV factories: abcd minty-green + white labels (line-tool-abcd); xabcd/
  // cypher tv-blue line + background @ transparency 85, white labels
  // (line-tool-5points-patterns `nonThemedFactoryDefaults`).
  "abcd-pattern": { kind: "abcd-pattern", pointCount: 4, preview: "line", isBbox: false, defaults: { color: MINTY, width: 2, textColor: "#ffffff", fontSize: 12 } },
  "xabcd-pattern": { kind: "xabcd-pattern", pointCount: 5, preview: "line", isBbox: false, defaults: { color: BLUE, width: 2, textColor: "#ffffff", backgroundColor: BLUE, fillBackground: true, transparency: 85, fontSize: 12 } },
  "cypher-pattern": { kind: "cypher-pattern", pointCount: 5, preview: "line", isBbox: false, defaults: { color: BLUE, width: 2, textColor: "#ffffff", backgroundColor: BLUE, fillBackground: true, transparency: 85, fontSize: 12 } },
  "head-and-shoulders": { kind: "head-and-shoulders", pointCount: 7, preview: "line", isBbox: false, defaults: { color: MINTY, width: 2, textColor: "#ffffff", fontSize: 12, fillBackground: true, backgroundColor: MINTY, transparency: 85 } },
  "triangle-pattern": { kind: "triangle-pattern", pointCount: 4, preview: "line", isBbox: false, defaults: { color: DEEP_PURPLE, width: 2, textColor: "#ffffff", fontSize: 12, fillBackground: true, backgroundColor: DEEP_PURPLE, transparency: 85 } },
  "three-drives-pattern": { kind: "three-drives-pattern", pointCount: 7, preview: "line", isBbox: false, defaults: { color: DEEP_PURPLE, width: 2, textColor: "#ffffff", fontSize: 12 } },
  "elliott-impulse": { kind: "elliott-impulse", pointCount: 6, preview: "line", isBbox: false, defaults: { color: "#3d85c6", width: 2 } },
  "elliott-correction": { kind: "elliott-correction", pointCount: 4, preview: "line", isBbox: false, defaults: { color: "#3d85c6", width: 2 } },
  "elliott-triangle": { kind: "elliott-triangle", pointCount: 6, preview: "line", isBbox: false, defaults: { color: ORANGE, width: 2 } },
  "elliott-double-combo": { kind: "elliott-double-combo", pointCount: 4, preview: "line", isBbox: false, defaults: { color: "#6aa84f", width: 2 } },
  "elliott-triple-combo": { kind: "elliott-triple-combo", pointCount: 6, preview: "line", isBbox: false, defaults: { color: "#6aa84f", width: 2 } },
  // freehand polylines (variable-length, double-click to finalize; pointCount = minimum)
  polyline: { kind: "polyline", pointCount: 2, preview: "line", isBbox: false, variableLength: true, defaults: { color: SKY, width: 2, fillBackground: true, transparency: 80 } },
  // TV path factory: lineWidth 2, leftEnd Normal, rightEnd Arrow.
  path: { kind: "path", pointCount: 2, preview: "line", isBbox: false, variableLength: true, defaults: { width: 2, leftEnd: 0, rightEnd: 1 } },
  // freehand brushes (drawn with the button held; sampled from pointer-move)
  // TV brush factory: no fill (backgroundColor rgba(0, 188, 212, 0.2) =
  // cyan at transparency 80), no line ends.
  brush: { kind: "brush", pointCount: 2, preview: "line", isBbox: false, freehand: true, defaults: { color: SKY, width: 2, fillBackground: false, backgroundColor: SKY, transparency: 80, leftEnd: 0, rightEnd: 0 } },
  highlighter: { kind: "highlighter", pointCount: 2, preview: "line", isBbox: false, freehand: true, defaults: { color: "#f23645", width: 20 } },
  // text annotations (inline editor on placement / double-click)
  // TV text factory: tv-blue-500 14px, no background (rgba(41,98,255,0.25)),
  // no border (#707070), no wrap (200px).
  text: { kind: "text", pointCount: 1, preview: "none", isBbox: false, textEditable: true, defaults: { color: BLUE, fontSize: 14, fillBackground: false, backgroundColor: BLUE, transparency: 75, drawBorder: false, borderColor: "#707070", wordWrap: false, wordWrapWidth: 200 } },
  // TV Note (LineToolTextNote): anchor + text label, leader line #DBDBDB,
  // label #DBDBDB on #2E2E2E.
  note: { kind: "note", pointCount: 2, preview: "line", isBbox: false, textEditable: true, defaults: { color: "#dbdbdb", textColor: "#dbdbdb", backgroundColor: "#2e2e2e", fillBackground: true, fontSize: 14 } },
  // TV Pin (LineToolNote): the map pin (marker #2962FF) with a text card.
  pin: { kind: "pin", pointCount: 1, preview: "none", isBbox: false, textEditable: true, defaults: { color: "#2962ff", textColor: "#dbdbdb", fontSize: 14, fillBackground: true, backgroundColor: "#2e2e2e", transparency: 0, drawBorder: false, borderColor: "#4a4a4a" } },
  // TV comment factory: white 16px text on a tv-blue-500 balloon, border
  // tv-blue-500 (2px), transparency 0.
  comment: { kind: "comment", pointCount: 1, preview: "none", isBbox: false, textEditable: true, defaults: { color: BLUE, textColor: "#ffffff", fontSize: 16, backgroundColor: BLUE, borderColor: BLUE, transparency: 0 } },
  // TV price note text factory: tv-blue-500, 14px, centre / bottom (the
  // dialog's "Top": box above the line).
  "price-note": { kind: "price-note", pointCount: 2, preview: "line", isBbox: false, textEditable: true, defaults: { color: BLUE, textColor: BLUE, fontSize: 14, horzLabelsAlign: "center", vertLabelsAlign: "bottom", priceLabelTextColor: "#ffffff", priceLabelFontSize: 12, priceLabelBackgroundColor: BLUE, priceLabelBorderColor: BLUE } },
  // TV signpost factory: 12px label, no emoji pin (plate tv-blue-500),
  // label halfway between the bar and the pane edge (position 50).
  signpost: { kind: "signpost", pointCount: 1, preview: "none", isBbox: false, textEditable: true, defaults: { fontSize: 12, showImage: false, plateColor: BLUE, signpostPosition: 50 } },
  // TV callout factory: sky-blue-700 border (2px) and background at
  // transparency 50, white 14px text, no wrap (200px).
  callout: { kind: "callout", pointCount: 2, preview: "line", isBbox: false, textEditable: true, defaults: { color: "#0097a7", width: 2, textColor: "#ffffff", fontSize: 14, backgroundColor: "#0097a7", transparency: 50, wordWrap: false, wordWrapWidth: 200 } },
  // font-icon (emoji / sticker / icon glyph placed at one point)
  // TV icon factory: size 72, colour tv-blue-500 (font icons; emoji keep
  // their own colours).
  "font-icon": { kind: "font-icon", pointCount: 1, preview: "none", isBbox: false, defaults: { fontSize: 72, color: BLUE } },
  // TV Table (line-tool-table, dark theme factory): 3 x 3 empty cells, columns
  // 120px, rows auto; background cold-gray-900 #0F0F0F, border cold-gray-650
  // #575757 (the toolbar line colour), text cold-gray-200 #DBDBDB 14px, left.
  table: { kind: "table", pointCount: 1, preview: "none", isBbox: false, defaults: { color: "#575757", backgroundColor: "#0f0f0f", textColor: "#dbdbdb", fontSize: 14, horzLabelsAlign: "left" } },
  // TV Image (line-tool-image): transparency 0; the file comes from the
  // Image dialog opened when the tool is armed.
  image: { kind: "image", pointCount: 1, preview: "none", isBbox: false, defaults: { transparency: 0 } },
  // data-driven (computed over the chart's bars in the selected range).
  // Regression trend (line-tool-regression-trend): base ± dev·σ study with
  // "Upper/Lower Deviation" inputs (+2/−2), channel fills, an "Extend Lines"
  // toggle (right only) and the Pearson's R label (styles.showPearsons).
  // TV factory styles: up / down lines #2962FF 2px solid, base line #F23645
  // 1px dashed, fills at transparency 70.
  "regression-trend": { kind: "regression-trend", pointCount: 2, preview: "line", isBbox: false, defaults: { upperDeviation: 2, lowerDeviation: -2, useUpperDeviation: true, useLowerDeviation: true, regressionSource: "close", showPearsons: true, fillBackground: true, transparency: 70, regressionLines: REGRESSION_LINE_DEFAULTS } },
  // fillBackground defined (off) so the Settings Background checkbox shows —
  // the renderer's band-interior fill gates on it.
  // TV anchoredvwap factory: VWAP #1e88e5 1px; areaBackground #4caf50 at
  // transparency 95 between UpperBand / LowerBand (band #1), on.
  "anchored-vwap": { kind: "anchored-vwap", pointCount: 1, preview: "none", isBbox: false, defaults: { color: "#1e88e5", width: 1, vwapSource: "hlc3", levels: VWAP_BAND_DEFAULTS, fillBackground: true, backgroundColor: "#4caf50", transparency: 95 } },
  "fixed-range-volume-profile": { kind: "fixed-range-volume-profile", pointCount: 2, preview: "rect", isBbox: true },
  "anchored-volume-profile": { kind: "anchored-volume-profile", pointCount: 1, preview: "none", isBbox: false },
};

const OVERLAY_KIND_IDS = new Set<string>(Object.keys(OVERLAY_SPECS));

export function findOverlaySpec(toolId: string | null): OverlaySpec | undefined {
  if (toolId && OVERLAY_KIND_IDS.has(toolId)) {
    return OVERLAY_SPECS[toolId as DrawingKind];
  }
  return undefined;
}

/** Resolve a fresh drawing's style: DEFAULT_STYLE merged with the kind's
 *  per-tool overrides. Used both when committing a new drawing and when
 *  rendering the live placement preview, so the in-progress draw looks exactly
 *  like the finished one (TV behaviour). */
export function defaultStyleFor(kind: DrawingKind): DrawingStyle {
  // Factory base + per-spec defaults, then any user-saved "Save as default"
  // override for this kind (so new drawings + Apply-default honour it).
  const style = { ...DEFAULT_STYLE, ...OVERLAY_SPECS[kind].defaults, ...defaultStyleOverride(kind) };
  // Deep-copy the level ladder so two drawings never share one array (level
  // edits in the settings dialog replace the array immutably, but a shared
  // reference would still leak factory-set edits across drawings).
  if (style.levels) style.levels = style.levels.map((l) => ({ ...l }));
  return style;
}

/** Host hook: the user's saved default style of a tool (OpenTrader: its
 *  saved "Save as default" templates), merged over the factory defaults by
 *  `defaultStyleFor`. */
let defaultStyleOverride: (kind: string) => DrawingStyle | undefined = () => undefined;
export function setDefaultStyleOverride(fn: (kind: string) => DrawingStyle | undefined): void {
  defaultStyleOverride = fn;
}
