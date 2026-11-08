/*
 * Chart <-> screen bridge used by the drawing core. The host (OpenTrader,
 * or the library runtime) implements it on its chart; the core only calls
 * it. Bar data type included (OHLC).
 */
import type { CreatePriceLineOptions, IPriceLine, Time } from "lightweight-charts";
import type { LabelContext, LabelFormatter } from "./labels";

export type OHLC = {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Bar volume — only populated for the daily/intraday history path;
   *  drives the volume-candle body sizing. Absent on live-tick updates
   *  (those chart types don't take incremental updates). */
  volume?: number;
};

/** Bars of the chart symbol on a lower timeframe (the volume profiles are built from them, as the reference
 *  app's volume profile study). Optional: without it the profiles use the chart bars. */
export type LowerTimeframe = {
  /** Bars on `resolution` ("1", "5", "15", "30", "60", "240", "1D", "1S") from `from` (epoch seconds) on;
   *  undefined while they load (the host redraws the drawings when they arrive). */
  bars: (resolution: string, from: number) => OHLC[] | undefined;
  /** End (epoch seconds) of the chart bar starting at `time`: its interval, a daily bar's session close. */
  barEnd: (time: number) => number;
  /** The chart interval is in seconds (its profiles use 1-second bars). */
  seconds: boolean;
};

export type Coords = {
  priceToY: (p: number) => number | null;
  yToPrice: (y: number) => number | null;
  /** TRUE while the series' price scale is logarithmic — gates the fib tools'
   *  "levels based on log scale" option (TV applies it only on a log scale). */
  isLog: () => boolean;
  timeToX: (t: Time) => number | null;
  xToTime: (x: number) => Time | null;
  /** Bar nearest a given time, used by the magnet snap. Returns null if
   *  no data has loaded yet. */
  barAt: (t: Time) => OHLC | null;
  /** Integer bar index (logical position, 0 = first loaded bar) for a time —
   *  the "Bar" value shown in the drawing settings' Coordinates tab. Negative
   *  before the first bar, ≥ length in the future. Null with no data. */
  timeToBarIndex: (t: Time) => number | null;
  /** Inverse of timeToBarIndex: the time at an integer bar index (extrapolated
   *  with the median bar interval outside the loaded range). Null with no data. */
  barIndexToTime: (i: number) => Time | null;
  /** The full current OHLC(V) array — used by the data-driven drawings
   *  (regression-trend, anchored-vwap, volume-profile) to compute over the
   *  bars in their selected range. */
  bars: () => OHLC[];
  /** Times (epoch seconds) of the first and last bar in view, or null with no
   *  data. Lets data-driven drawings project only the visible slice. */
  visibleTimeRange: () => { from: number; to: number } | null;
  /** Price-pane overlay-indicator values at a given bar time — extra snap
   *  candidates for the magnet's "Snap to indicator" mode. Empty when no
   *  overlay study is active (or the accessor wasn't wired). */
  indicatorValuesAt: (t: Time) => number[];
  /** Smallest price increment for the series (the series' `priceFormat.minMove`,
   *  e.g. 0.01 for cent-quoted stocks). Used to convert a price delta into pips
   *  for the line-family stats badge. Falls back to 0.01. */
  pipSize: () => number;
  /** Create a right-axis price pill (a lightweight-charts price line, body
   *  hidden) for drawings with `showPriceLabels`. Returns the handle so the
   *  caller can update (`applyOptions`) or remove it. */
  addPriceLine: (opts: CreatePriceLineOptions) => IPriceLine;
  removePriceLine: (line: IPriceLine) => void;
  /** Zoom the chart to a screen-space rectangle (the "Zoom in" drag tool):
   *  sets the visible time (logical) range and the price-scale range to the
   *  dragged box. Price-axis zoom switches the scale to manual (autoScale off). */
  zoomToScreenRect: (x1: number, x2: number, y1: number, y2: number) => void;
  /** The chart's own time label text for a bar time (the crosshair
   *  `localization.timeFormatter`: TV weekday / date format / time). */
  formatTime: (t: Time) => string;
  /** Time-axis strip metrics: height and width (px) and the axis font. */
  timeAxis: () => { height: number; width: number; fontSize: number; fontFamily: string };
  /** The chart's display time zone and whether its interval is intraday
   *  (bar times are UTC epoch seconds shown in that zone). */
  timeInfo: () => { timeZone: string; intraday: boolean };
  /** Lower-timeframe bars of the chart symbol (volume profile drawings); optional. */
  lowerTimeframe?: LowerTimeframe;
  /** Label text hook: called for every label with its default text and raw
   *  numbers; return the text to draw (undefined / null = the default, "" = empty). */
  formatLabel?: LabelFormatter;
  /** Kind and id of the drawing being built / hit-tested, set by sceneOf and
   *  hitTestKind (withLabelContext) so every label carries them. */
  labelContext?: LabelContext;
};
