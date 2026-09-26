/*
 * Drawing types shared across DrawingToolbar, App, ChartView, and the
 * DrawingsOverlay.
 *
 * Storage is data-space: each drawing's geometry is one or more
 * `{time, price}` data points. Screen-space projection happens at render
 * time via `Coords` so pan/zoom + chart rebuilds preserve placement.
 */
import type { Time } from "lightweight-charts";

export type DataPoint = { time: Time; price: number };

export type LineStyle = "solid" | "dashed" | "dotted";

export type DrawingStyle = {
  color: string;
  width: number;
  lineStyle: LineStyle;
  /** Colour for text labels (price/time labels, on-line text). Mirrors TV's
   *  `textColor`. Optional so existing drawings & non-text kinds are
   *  unaffected; renderers fall back to `color` when unset. */
  textColor?: string;
  /** Extend the line past p1/p2 to the pane edge. Mirrors TV `extendLeft`/
   *  `extendRight`. Ray defaults to right-only, extended-line to both; when a
   *  flag is unset the renderer uses the kind's intrinsic default (renderKind). */
  extendLeft?: boolean;
  extendRight?: boolean;

  // ── Line-family visuals (trend-line / ray / extended-line / info-line /
  //    trend-angle). All optional + default-off so existing drawings and other
  //    kinds are unaffected. Names mirror the captured TV `LineTool*` state. ──
  /** Small filled dot at the segment midpoint. TV `showMiddlePoint`. */
  showMiddlePoint?: boolean;
  /** Endpoint caps: 0 = none, 1 = arrowhead. TV `leftEnd` / `rightEnd`. */
  leftEnd?: number;
  rightEnd?: number;
  /** On-line text label + its font styling. TV `text`/`fontsize`/`bold`/
   *  `italic`. Empty text renders nothing. */
  text?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  /** Label anchor. TV `horzLabelsAlign` / `vertLabelsAlign`. */
  horzLabelsAlign?: "left" | "center" | "right";
  vertLabelsAlign?: "top" | "middle" | "bottom";
  /** Floating stats badge near the midpoint (price/percent/pips · bars/
   *  duration/distance · angle), each row gated by a granular flag. TV
   *  `alwaysShowStats` + the `show*` flags. */
  showStats?: boolean;
  /** TV statsPosition: 0 Left (p0), 1 Center (middle), 2 Right (p1), 3 Auto
   *  (middle, kept in the pane and off the line). Unset = the TV factory
   *  value of the kind (info line 1, other line tools 2). */
  statsPosition?: 0 | 1 | 2 | 3;
  showPriceRange?: boolean;
  showPercentPriceRange?: boolean;
  showPipsPriceRange?: boolean;
  showBarsRange?: boolean;
  showDateTimeRange?: boolean;
  showDistance?: boolean;
  showAngle?: boolean;

  /** Fib level tools (TV): level texts on / their alignment (retracement,
   *  extension; factory on, centre / middle), full circles (speed arcs),
   *  counterclockwise (spiral), pitchfork lines extended backwards
   *  (extendLines). */
  showText?: boolean;
  horzTextAlign?: "left" | "center" | "right";
  vertTextAlign?: "top" | "middle" | "bottom";
  fullCircles?: boolean;
  counterclockwise?: boolean;
  extendLines?: boolean;
  /** Range tools (TV): extend top / bottom (date range), volume stat,
   *  label background (fillLabelBackground / labelBackgroundColor), border
   *  width (date and price range border). */
  extendTop?: boolean;
  extendBottom?: boolean;
  showVolume?: boolean;
  fillLabelBackground?: boolean;
  labelBackgroundColor?: string;
  borderWidth?: number;
  /** Text tools (TV drawBorder / wordWrap / wordWrapWidth): a border around
   *  the text box, and wrapping at a fixed width (text, callout). */
  drawBorder?: boolean;
  wordWrap?: boolean;
  wordWrapWidth?: number;
  /** Signpost (TV showImage / plateColor / position): the emoji pin and its
   *  colour; `signpostPosition` = the label's vertical place in the pane in
   *  percent (TV `position`, factory 50). */
  showImage?: boolean;
  plateColor?: string;
  signpostPosition?: number;
  /** TV vertical line "Extend" (extendLine, factory on): the line runs
   *  through every pane of the chart (OpenTrader draws in the main pane). */
  extendLine?: boolean;
  /** TV vertical line text orientation (factory vertical). */
  textOrientation?: "vertical" | "horizontal";
  /** TV Elliott waves "Wave" (showWave, factory on): the wave lines; off =
   *  the labels only. */
  showWave?: boolean;

  // ── Axis labels ───────────────────────────────────────────────────────────
  /** Right-axis price pill at each endpoint (rendered via the chart's price
   *  scale, not SVG). TV `showPriceLabels`. */
  showPriceLabels?: boolean;
  /** Time-axis label at the foot of a vertical-line / cross-line. TV `showTime`. */
  showTime?: boolean;

  // ── Shape interior fill (rectangle / circle / ellipse / triangle / rotated-
  //    rectangle). Maps TV `fillBackground` / `backgroundColor` /
  //    `transparency`. When absent the renderer falls back to the legacy
  //    translucent stroke-colour fill (see _shared.ts `fillStyle`). ──────────
  /** Whether the shape interior is filled. TV `fillBackground`. */
  fillBackground?: boolean;
  /** Fill colour, independent of the stroke `color`. TV `backgroundColor`.
   *  Falls back to `color` when unset. */
  backgroundColor?: string;
  /** Fill transparency on TV's 0-100 scale (higher = more transparent).
   *  Rendered opacity = (100 - transparency) / 100. Unset → legacy 0.08. */
  transparency?: number;

  // ── Per-level model (fib retracement/extension/channel, pitchfork family,
  //    gann fan). Mirrors TV's `level1..levelN` state: each level has its own
  //    coefficient, colour and visibility; fills render between adjacent
  //    visible levels using `fillBackground`/`transparency` above. Unset →
  //    the kind's factory set (specs.ts defaults). ─────────────────────────
  levels?: LevelDef[];
  /** Mirror the level ladder (TV `reverse`, fib retracement/extension). */
  reverse?: boolean;
  /** Fib retracement: label levels as percentages ("61.8%" instead of
   *  "0.618"). Settings "Levels as percents" checkbox. */
  fibLevelsAsPercents?: boolean;
  /** Fib retracement / trend-based extension: interpolate the level PRICES in
   *  ln(price) space (TV `fibLevelsBasedOnLogScale`). Like TV's `isLog()`
   *  gate, only in effect while the chart's price scale is logarithmic. */
  fibLevelsBasedOnLogScale?: boolean;

  // ── Position tool (long/short). TV's risk-reward model: the stop and
  //    target are price OFFSETS from the entry (TV stores ticks; we store
  //    price units), sized at placement to 20% of the visible range (1:1).
  //    Unset on legacy drawings → derived from the old mirrored-target
  //    points at render time. ────────────────────────────────────────────
  stopLevel?: number;
  profitLevel?: number;
  /** Risk inputs driving the Qty readout: qty = accountSize·risk% / (stop ·
   *  lotSize). Mirrors TV's accountSize / risk / lotSize (factory 1000/25/1). */
  accountSize?: number;
  riskPercent?: number;
  lotSize?: number;
  /** TV riskDisplayMode: risk as a percent of the account (factory) or as a
   *  money amount (`riskAmount`, capped at the account size). */
  riskDisplayMode?: "percents" | "money";
  riskAmount?: number;
  /** TV leverage (factory 10000): qty is capped at leverage · account / entry. */
  leverage?: number;
  /** TV qtyPrecision: "default" (stocks: floor) or "0".."10" decimals. */
  qtyPrecision?: string;
  /** Position colours (TV stopBackground / profitBackground + their
   *  transparency, factory #F23645 / #089981 at 80): zones and stop /
   *  target lines at (100 − transparency)%, labels opaque. */
  stopColor?: string;
  stopTransparency?: number;
  targetColor?: string;
  targetTransparency?: number;
  /** TV infoBlocks (Stats): the parts shown in the target / middle / stop
   *  labels; unset keys = the TV factory (all on except TP PL / SL PL). */
  positionStats?: Partial<Record<PositionStatKey, boolean>>;
  /** TV compact stats mode. */
  compactStats?: boolean;

  // ── Table (TV line-tool-table): rows of cell texts, column widths and row
  //    heights in screen px (row height 0 = auto). Border colour = `color`,
  //    plus backgroundColor / textColor / fontSize / horzLabelsAlign. TV keeps
  //    cells and sizes in the template, so they live in the style. ──────────
  tableCells?: string[][];
  tableColWidths?: number[];
  tableRowHeights?: number[];

  /** Parallel channel: the dashed middle line (TV shows it by default). */
  middleLine?: boolean;
  /** Rectangle middle line (TV `middleLine`: showLine / lineColor /
   *  lineWidth / lineStyle; factory off, the rectangle colour, 1px, dashed). */
  rectMiddleLine?: RegressionLine;
  /** Fib channel labels (TV showPrices / showCoeffs / labelFontSize, factory
   *  on / on / 12); level values as percents = `fibLevelsAsPercents`. */
  showPrices?: boolean;
  showCoeffs?: boolean;
  /** Fib time zone level labels (TV showLabels, factory on). */
  showLabels?: boolean;
  /** Fib speed resistance fan (TV): time levels (`vlevel*`; `levels` = the
   *  price levels), coefficient labels per side (factory all on) and the
   *  grid (factory on, rgba(21, 56, 153, 0.8), 1px, solid). */
  vLevels?: LevelDef[];
  /** Trend-based fib time: the p0-p1-p2 trend lines (TV `trendline`,
   *  factory on, #808080, 2px, dashed). */
  fibTrendLine?: RegressionLine;
  /** Gann square / Gann square fixed (TV levels / fanlines / arcs; the arcs
   *  fill = fillBackground + transparency). */
  gannLevels?: GannLine[];
  gannFans?: GannRatioLine[];
  gannArcs?: GannRatioLine[];
  /** Sector (TV projection): background gradient colours color1 → color2
   *  (factory tv-blue-500 → grapes-purple-500 at 80 transparency). */
  sectorColor1?: string;
  sectorColor2?: string;
  /** Gann box (TV): time-levels background (fillVertBackground /
   *  vertTransparency; the price levels use fillBackground / transparency)
   *  and the angle lines (fans: visible / color, factory off, #9C9C9C). */
  fillVertBackground?: boolean;
  vertTransparency?: number;
  fans?: { visible: boolean; color: string };
  showLeftLabels?: boolean;
  showRightLabels?: boolean;
  showTopLabels?: boolean;
  showBottomLabels?: boolean;
  fanGrid?: RegressionLine;
  labelFontSize?: number;
  /** Price note price label (TV priceLabel*: text colour / size / bold /
   *  italic, background, border; factory white, 12px, tv-blue-500 x2). The
   *  line colour is `color`. */
  /** Position forecast (TV line-tool-prediction): balloon colours; the
   *  backgrounds, borders and status banners are drawn at `transparency`
   *  (factory 10). */
  sourceTextColor?: string;
  sourceBackColor?: string;
  sourceStrokeColor?: string;
  targetTextColor?: string;
  targetBackColor?: string;
  targetStrokeColor?: string;
  successTextColor?: string;
  successBackground?: string;
  failureTextColor?: string;
  failureBackground?: string;
  priceLabelTextColor?: string;
  priceLabelFontSize?: number;
  priceLabelBold?: boolean;
  priceLabelItalic?: boolean;
  priceLabelBackgroundColor?: string;
  priceLabelBorderColor?: string;

  /** Trend-angle: the displayed angle in degrees, frozen in SCREEN space at
   *  placement / anchor-drag end (TV stores `angle` + `distance` and derives
   *  the second point, so zooming never changes the readout). */
  angle?: number;

  /** Bar-pattern display model (TV `mode` / `mirrored` / `flipped`):
   *  "line" draws a close-price polyline instead of candles; mirrored
   *  reverses the bar order; flipped inverts prices around the pattern base. */
  patternMode?: "bars" | "oc" | "line" | "line-open" | "line-high" | "line-low" | "line-hl2";
  /** Ghost feed candle style (TV candleStyle): body up / down colours,
   *  borders (on + up / down colours), wick (on + colour). */
  ghostCandle?: GhostCandleStyle;
  mirrored?: boolean;
  flipped?: boolean;

  /** Ghost-feed candle randomness on TV's 0-100 scale (factory 50): 0 = every
   *  bar spans exactly the frozen amplitude, 100 = maximum jitter. */
  variance?: number;

  // ── Regression trend (study model, line-tool-regression-trend chunk). The
  //    bands sit at base ± dev·σ of the close-vs-index fit residuals; TV's
  //    study inputs "Upper Deviation" / "Lower Deviation" (factory +2 / −2).
  //    `showPearsons` mirrors styles.showPearsons (Pearson's R label under the
  //    down line's start); extend-right maps TV's single styles.extendLines. ──
  /** Range tools custom text style (TV `customText`: colour, size, bold,
   *  italic; the string itself is `text`). Factory #2962FF, 12px. */
  customTextColor?: string;
  customTextSize?: number;
  customTextBold?: boolean;
  customTextItalic?: boolean;
  /** Callout border colour (TV `bordercolor`); unset = the bubble colour. */
  borderColor?: string;

  /** Elliott wave degree (TV `degree`): 0 Supermillennium … 14 Minuscule,
   *  factory 7 (Intermediate). Drives the label set, size and decoration. */
  elliottDegree?: number;

  upperDeviation?: number;
  lowerDeviation?: number;
  /** TV "Use Upper / Lower Deviation" (factory on). Off: the line sits at the
   *  largest bar high above (low below) the base line instead of dev·σ. */
  useUpperDeviation?: boolean;
  useLowerDeviation?: boolean;
  /** TV study `source` (factory close): the series the base line, σ and
   *  Pearson's R are computed on. */
  regressionSource?: "open" | "high" | "low" | "close" | "hl2" | "hlc3" | "ohlc4" | "hlcc4";
  showPearsons?: boolean;
  /** TV styles.baseLine / upLine / downLine: visibility, colour, width, style
   *  per line (the fills take the line colour at `transparency`). */
  regressionLines?: { base: RegressionLine; up: RegressionLine; down: RegressionLine };

  /** Anchored VWAP source series (TV study `source` input; the classic VWAP
   *  typical price hlc3 is the fallback). The ±σ band ladder rides `levels`
   *  (coeff = the band's multiplier). */
  vwapSource?: "open" | "high" | "low" | "close" | "hl2" | "hlc3" | "ohlc4" | "hlcc4";
  /** Anchored VWAP (TV study): band distance unit ("Bands Calculation
   *  Mode": Standard Deviation, or Percentage where multiplier 1 = 1% of the
   *  VWAP), the upper / lower line of each band (UpperBand / LowerBand
   *  styles: visible, colour, width) and the VWAP price-scale label
   *  (axisLabelVisible, factory on). */
  vwapBandsMode?: "stdev" | "percent";
  vwapUpper?: RegressionLine[];
  vwapLower?: RegressionLine[];
  vwapPriceLabel?: boolean;
};

/** One configurable level of a levels-based tool. `label` overrides the
 *  coefficient text (gann-fan's "1/8".."8/1"); `width`/`style` override the
 *  drawing's stroke per level (TV's per-level linewidth/linestyle). */
/** Ghost feed candle style (TV `candleStyle`). */
export type GhostCandleStyle = {
  upColor: string;
  downColor: string;
  drawBorder: boolean;
  borderUpColor: string;
  borderDownColor: string;
  drawWick: boolean;
  wickColor: string;
};

/** One regression trend line (TV study plot style). */
/** Gann level line (TV levels.N: color, width, visible). */
export type GannLine = { color: string; width: number; visible: boolean };
/** Gann fan / arc line with its x·y ratio (TV fanlines.N / arcs.N). */
export type GannRatioLine = GannLine & { x: number; y: number };

/** TV risk / reward infoBlocks keys. */
export type PositionStatKey =
  | "tpPriceOffset" | "tpPercentOffset" | "tpTickOffset" | "tpAmount" | "tpPL"
  | "openClosePL" | "qty" | "riskRewardRatio"
  | "slPriceOffset" | "slPercentOffset" | "slTickOffset" | "slAmount" | "slPL";

export type RegressionLine = { visible: boolean; color: string; width: number; style: LineStyle };

export type LevelDef = {
  coeff: number;
  color: string;
  visible: boolean;
  label?: string;
  width?: number;
  style?: LineStyle;
  /** TV fib level text (levelN.text), shown with `showText`. */
  text?: string;
};

/** Universal fallback style — the TradingView factory base (its trend-line
 *  defaults: blue, 1px, solid). Per-tool overrides live in each spec's
 *  `defaults` (see specs.ts `defaultStyleFor`); a kind with no override gets
 *  this. Most tools inherit 1px; the heavier line/shape tools override to 2px. */
export const DEFAULT_STYLE: DrawingStyle = {
  color: "#2962ff",
  width: 1,
  lineStyle: "solid",
};

/* ── Per-interval visibility (TV's Visibility tab) ──────────────────────────
 * Captured live (3.2.0.7916): one row per interval unit, each a checkbox plus
 * a from/to range inside the unit — Ticks (checkbox only), Seconds 1-59,
 * Minutes 1-59, Hours 1-24, Days 1-366, Weeks 1-52, Months 1-12, Ranges
 * (checkbox only). A drawing renders only when the chart interval matches an
 * enabled row's range. Absent field (older saved drawings) = always visible. */
export type UnitVisibility = { on: boolean; from: number; to: number };
export type IntervalVisibility = {
  ticks: boolean;
  seconds: UnitVisibility;
  minutes: UnitVisibility;
  hours: UnitVisibility;
  days: UnitVisibility;
  weeks: UnitVisibility;
  months: UnitVisibility;
  ranges: boolean;
};

/** TV's defaults: every unit on, full range. */
export const DEFAULT_VISIBILITY: IntervalVisibility = {
  ticks: true,
  seconds: { on: true, from: 1, to: 59 },
  minutes: { on: true, from: 1, to: 59 },
  hours: { on: true, from: 1, to: 24 },
  days: { on: true, from: 1, to: 366 },
  weeks: { on: true, from: 1, to: 52 },
  months: { on: true, from: 1, to: 12 },
  ranges: true,
};

/** TRUE when a drawing with visibility `v` should render on `interval`.
 *  Interval strings follow the app's TV-style format: bare number = minutes
 *  ("1", "5", "240"; multiples of 60 read as hours), "NS" seconds, "NT" ticks,
 *  "NR" ranges, "ND" days, "NW" weeks, "NM" months. Unknown formats stay
 *  visible (fail open). */
export function isVisibleOnInterval(v: IntervalVisibility | undefined, interval: string | undefined): boolean {
  if (!v || !interval) return true;
  const m = /^(\d+)([A-Z]+)?$/.exec(interval.trim().toUpperCase());
  if (!m) return true;
  const n = Math.max(1, parseInt(m[1], 10));
  const inRange = (u: UnitVisibility, value: number) => u.on && value >= u.from && value <= u.to;
  switch (m[2]) {
    case "T": return v.ticks;   // tick charts  ("1T".."1000T")
    case "R": return v.ranges;  // range charts ("1R".."1000R")
    case "S": return inRange(v.seconds, n);
    case "D": return inRange(v.days, n);
    case "W": return inRange(v.weeks, n);
    case "M": return inRange(v.months, n);
    case undefined: {
      // Bare number = minutes. TV files 60-minute multiples under the Hours
      // row, sub-hour under Minutes; an odd >59-minute frame (e.g. a custom
      // 90m) is filed by its hour span so it can't fail CLOSED against the
      // 1-59 Minutes row.
      if (n % 60 === 0) return inRange(v.hours, n / 60);
      if (n < 60) return inRange(v.minutes, n);
      return inRange(v.hours, Math.round(n / 60));
    }
    default: return true; // unknown unit → stay visible (fail open)
  }
}

export type DrawingKind =
  // 1-point
  | "horizontal-line"
  | "horizontal-ray"
  | "vertical-line"
  | "cross-line"
  | "arrow-marker"
  | "arrow-mark-up"
  | "arrow-mark-down"
  | "price-label"
  | "flag-mark"
  // 2-point
  | "trend-line"
  | "ray"
  | "extended-line"
  | "info-line"
  | "trend-angle"
  | "long-position"
  | "short-position"
  | "gann-fan"
  | "gann-box"
  | "fib-time-zone"
  | "fib-circles"
  | "fib-speed-resistance-fan"
  | "fib-speed-resistance-arcs"
  | "fib-spiral"
  | "fib-wedge"
  | "pitchfan"
  | "cyclic-lines"
  | "sine-line"
  | "time-cycles"
  | "arrow"
  | "rectangle"
  | "circle"
  | "ellipse"
  | "fib-retracement"
  | "price-range"
  | "date-range"
  | "date-and-price-range"
  | "position-forecast"
  | "bar-pattern"
  | "ghost-feed"
  // 3-point
  | "triangle"
  | "parallel-channel"
  | "pitchfork"
  | "schiff-pitchfork"
  | "modified-schiff-pitchfork"
  | "inside-pitchfork"
  | "trend-based-fib-extension"
  | "trend-based-fib-time"
  | "gann-square-fixed"
  | "gann-square"
  | "sector"
  | "disjoint-channel"
  | "flat-top-bottom"
  | "fib-channel"
  | "rotated-rectangle"
  | "curve"
  | "arc"
  // 4-point
  | "double-curve"
  // N-point pattern / Elliott family (labeled polylines/polygons)
  | "abcd-pattern"
  | "xabcd-pattern"
  | "cypher-pattern"
  | "head-and-shoulders"
  | "triangle-pattern"
  | "three-drives-pattern"
  | "elliott-impulse"
  | "elliott-correction"
  | "elliott-triangle"
  | "elliott-double-combo"
  | "elliott-triple-combo"
  // freehand (variable-length, double-click to finalize)
  | "polyline"
  | "path"
  | "brush"
  | "highlighter"
  // text annotations (carry an editable `text` field)
  | "text"
  | "note"
  | "pin"
  | "comment"
  | "price-note"
  | "signpost"
  | "callout"
  // font-icon (emoji / sticker / icon glyph placed at one point)
  | "font-icon"
  // table / image (TV line-tool-table / line-tool-image, 1 point)
  | "table"
  | "image"
  // data-driven (compute over the chart's bars in the selected range)
  | "regression-trend"
  | "anchored-vwap"
  | "fixed-range-volume-profile"
  | "anchored-volume-profile";

/** Pattern / Elliott-wave family — rendered as a single labeled polyline/polygon
 *  through a variable number of vertices (see DrawingsOverlay renderLabeledPolyline). */
export type PatternKind =
  | "abcd-pattern"
  | "xabcd-pattern"
  | "cypher-pattern"
  | "head-and-shoulders"
  | "triangle-pattern"
  | "three-drives-pattern"
  | "elliott-impulse"
  | "elliott-correction"
  | "elliott-triangle"
  | "elliott-double-combo"
  | "elliott-triple-combo";

/** Freehand family — variable-length polylines placed click-per-vertex and
 *  finalized with a double-click (the spec carries `variableLength: true`). */
export type FreehandKind = "polyline" | "path" | "brush" | "highlighter";

type WithId<T> = T & {
  id: string;
  style: DrawingStyle;
  /** User-editable display name (the input under the settings-dialog title;
   *  TV defaults it to the tool's label). Shown in listings when set. */
  name?: string;
  /** Editable annotation text for the text family (text/note/comment/price-note/
   *  signpost/callout). Empty/undefined renders a faint placeholder. */
  text?: string;
  /** Glyph payload for the `font-icon` kind — a Unicode emoji char OR raw
   *  `<svg>` markup (icon/sticker). Rendered at the placement point. */
  glyph?: string;
  /** Bar-pattern frozen snapshot (TV model): the OHLC rows captured at
   *  placement + the first bar's open as the anchor base. Rendered at
   *  consecutive bar indices from p0, offset by (p0.price − base) — real
   *  price scale, never renormalised into the box. */
  pattern?: { base: number; bars: [number, number, number, number][] };
  /** Ghost-feed generation params (TV model): a stable seed + the ATR-based
   *  candle amplitude (price units) captured at placement, so the simulated
   *  candles survive moves/reloads and resize with the drift line. */
  ghost?: { seed: number; amplitude: number };
  /** Image tool (TV line-tool-image): the stored file name (app data
   *  `drawing-images/`) and the drawn size in screen px (TV cssWidth /
   *  cssHeight). The point is the image centre. Not a style field: TV keeps
   *  the url out of templates. `dx` = transient x offset of the centre
   *  during a corner drag (TV dOffsetX), dropped when the drag ends. */
  image?: { name: string; cssWidth: number; cssHeight: number; dx?: number };
  /** TV "Anchor drawing" (property `anchored`; text, pin, table -
   *  interact/anchor.ts): the drawing is fixed
   *  to the screen at these pane fractions (TV positionPercents: x / time
   *  scale width, y / pane height) and does not move with the chart. The
   *  data point is kept for when it is unanchored. */
  anchored?: { x: number; y: number };
  /** Polyline closed into a shape (TV `filled`): set when the drawing is
   *  finished on its first point or an end point is dragged onto the other
   *  end. Only a closed polyline draws its closing side and its fill. */
  closed?: boolean;
  /** Locked drawings can be selected but not dragged or deleted via Delete-key. */
  locked?: boolean;
  /** Hidden drawings are not rendered or hit-tested. Toggle via context menu;
   *  unhiding from the chart requires re-selecting through the ObjectTreePanel
   *  (not yet built). */
  hidden?: boolean;
  /** Per-interval visibility matrix (Settings → Visibility). Absent = always
   *  visible (the default for drawings saved before this field existed). */
  visibility?: IntervalVisibility;
  /** Point-model format version for kinds whose stored-point MEANING changed
   *  without a count change (circle: bbox corners → center + radius point;
   *  arc: [start, control, end] → [chord start, chord end, bulge]). Absent =
   *  pre-change entry that migrateDrawing converts once; 2 = current model. */
  fmt?: number;
  /** ObjectTree group tag — drawings sharing a tag render under one group
   *  header in the panel (set/cleared by its Manage mode). */
  group?: string;
};

type OnePoint =
  | { kind: "horizontal-line"; points: [DataPoint] }
  | { kind: "horizontal-ray"; points: [DataPoint] }
  | { kind: "vertical-line"; points: [DataPoint] }
  | { kind: "cross-line"; points: [DataPoint] }
  | { kind: "arrow-mark-up"; points: [DataPoint] }
  | { kind: "arrow-mark-down"; points: [DataPoint] }
  | { kind: "price-label"; points: [DataPoint] }
  | { kind: "flag-mark"; points: [DataPoint] }
  | { kind: "text"; points: [DataPoint] }
  | { kind: "note"; points: [DataPoint, DataPoint] }
  | { kind: "pin"; points: [DataPoint] }
  | { kind: "comment"; points: [DataPoint] }
  | { kind: "signpost"; points: [DataPoint] }
  | { kind: "font-icon"; points: [DataPoint] }
  | { kind: "table"; points: [DataPoint] }
  | { kind: "image"; points: [DataPoint] }
  | { kind: "anchored-vwap"; points: [DataPoint] };

type TwoPoint =
  | { kind: "arrow-marker"; points: [DataPoint, DataPoint] }
  | { kind: "price-note"; points: [DataPoint, DataPoint] }
  | { kind: "trend-line"; points: [DataPoint, DataPoint] }
  | { kind: "ray"; points: [DataPoint, DataPoint] }
  | { kind: "extended-line"; points: [DataPoint, DataPoint] }
  | { kind: "info-line"; points: [DataPoint, DataPoint] }
  | { kind: "trend-angle"; points: [DataPoint, DataPoint] }
  | { kind: "long-position"; points: [DataPoint, DataPoint] }
  | { kind: "short-position"; points: [DataPoint, DataPoint] }
  | { kind: "gann-fan"; points: [DataPoint, DataPoint] }
  | { kind: "gann-box"; points: [DataPoint, DataPoint] }
  | { kind: "fib-time-zone"; points: [DataPoint, DataPoint] }
  | { kind: "fib-circles"; points: [DataPoint, DataPoint] }
  | { kind: "fib-speed-resistance-fan"; points: [DataPoint, DataPoint] }
  | { kind: "fib-speed-resistance-arcs"; points: [DataPoint, DataPoint] }
  | { kind: "fib-spiral"; points: [DataPoint, DataPoint] }
  | { kind: "cyclic-lines"; points: [DataPoint, DataPoint] }
  | { kind: "sine-line"; points: [DataPoint, DataPoint] }
  | { kind: "time-cycles"; points: [DataPoint, DataPoint] }
  | { kind: "arrow"; points: [DataPoint, DataPoint] }
  | { kind: "rectangle"; points: [DataPoint, DataPoint] }
  | { kind: "circle"; points: [DataPoint, DataPoint] }
  | { kind: "fib-retracement"; points: [DataPoint, DataPoint] }
  | { kind: "price-range"; points: [DataPoint, DataPoint] }
  | { kind: "date-range"; points: [DataPoint, DataPoint] }
  | { kind: "date-and-price-range"; points: [DataPoint, DataPoint] }
  | { kind: "position-forecast"; points: [DataPoint, DataPoint] }
  | { kind: "bar-pattern"; points: [DataPoint, DataPoint] }
  | { kind: "callout"; points: [DataPoint, DataPoint] }
  | { kind: "regression-trend"; points: [DataPoint, DataPoint] }
  | { kind: "fixed-range-volume-profile"; points: [DataPoint, DataPoint] }
  | { kind: "anchored-volume-profile"; points: [DataPoint] };

type ThreePoint =
  | { kind: "triangle"; points: [DataPoint, DataPoint, DataPoint] }
  | { kind: "fib-wedge"; points: [DataPoint, DataPoint, DataPoint] }
  | { kind: "pitchfan"; points: [DataPoint, DataPoint, DataPoint] }
  | { kind: "ellipse"; points: [DataPoint, DataPoint, DataPoint] }
  | { kind: "parallel-channel"; points: [DataPoint, DataPoint, DataPoint] }
  | { kind: "pitchfork"; points: [DataPoint, DataPoint, DataPoint] }
  | { kind: "trend-based-fib-extension"; points: [DataPoint, DataPoint, DataPoint] }
  | { kind: "trend-based-fib-time"; points: [DataPoint, DataPoint, DataPoint] }
  | { kind: "gann-square-fixed"; points: [DataPoint, DataPoint] }
  | { kind: "gann-square"; points: [DataPoint, DataPoint] }
  | { kind: "sector"; points: [DataPoint, DataPoint, DataPoint] }
  | { kind: "disjoint-channel"; points: [DataPoint, DataPoint, DataPoint] }
  | { kind: "flat-top-bottom"; points: [DataPoint, DataPoint, DataPoint] }
  | { kind: "schiff-pitchfork"; points: [DataPoint, DataPoint, DataPoint] }
  | { kind: "modified-schiff-pitchfork"; points: [DataPoint, DataPoint, DataPoint] }
  | { kind: "inside-pitchfork"; points: [DataPoint, DataPoint, DataPoint] }
  | { kind: "fib-channel"; points: [DataPoint, DataPoint, DataPoint] }
  | { kind: "rotated-rectangle"; points: [DataPoint, DataPoint, DataPoint] }
  | { kind: "curve"; points: [DataPoint, DataPoint, DataPoint] }
  | { kind: "arc"; points: [DataPoint, DataPoint, DataPoint] };

type FourPoint =
  | { kind: "double-curve"; points: [DataPoint, DataPoint, DataPoint, DataPoint] };

/** Variable-length labeled polyline/polygon — one variant covers the pattern/
 *  Elliott family plus the freehand tools. Fixed patterns enforce their vertex
 *  count via the spec's pointCount; freehand tools place until a double-click. */
type PolyPoint = { kind: PatternKind | FreehandKind; points: DataPoint[] };

/** Ghost feed — variable-length (TV pointsCount −1): every click after the
 *  first appends another drift-segment vertex; candles generate along each
 *  leg. Stored 2-point feeds are just 2-vertex polylines — no migration. */
type GhostFeedPoint = { kind: "ghost-feed"; points: DataPoint[] };

export type Drawing = WithId<OnePoint | TwoPoint | ThreePoint | FourPoint | PolyPoint | GhostFeedPoint>;

/** Payload accepted by App.addDrawing — caller doesn't supply the id. The
 *  optional `text` rides along so text-family placements can carry their
 *  typed content through addDrawing's `...d` spread; `style`, when present,
 *  replaces the kind's default style (position placement freezes its
 *  stop/profit offsets into it). */
export type NewDrawing = (OnePoint | TwoPoint | ThreePoint | FourPoint | PolyPoint | GhostFeedPoint) & {
  text?: string;
  glyph?: string;
  image?: { name: string; cssWidth: number; cssHeight: number };
  style?: DrawingStyle;
  pattern?: { base: number; bars: [number, number, number, number][] };
  ghost?: { seed: number; amplitude: number };
  closed?: boolean;
  fmt?: number;
};
