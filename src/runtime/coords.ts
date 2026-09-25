/*
 * Coords — pixel <-> data bridge of the drawings, built from a
 * lightweight-charts chart + series (moved from OpenTrader
 * window/drawings/coords.ts, port phase 3). Types only are imported from
 * lightweight-charts, so a host with its own lightweight-charts build (e.g. a
 * fork) keeps a single copy.
 *
 * `barAt` is the magnet snap helper: time -> closest OHLC bar. `getRaw`
 * returns the host's latest bar array, so no rebuild is needed when data
 * changes.
 */
import type { IChartApi, ISeriesApi, Logical, SeriesType, Time } from "lightweight-charts";
import type { Coords, OHLC } from "../tv/coords";

/** lightweight-charts PriceScaleMode.Logarithmic (a const enum value; not
 *  imported so no lightweight-charts runtime is pulled in). */
const PRICE_SCALE_MODE_LOG = 1;

export function makeCoords(
  chart: IChartApi,
  series: ISeriesApi<SeriesType>,
  getRaw: () => OHLC[],
  /** Resolves overlay-indicator values at an epoch-seconds bar time. Injected
   *  by ChartView (reads the live IndicatorController); defaults to none. */
  getIndicatorValues: (sec: number | null) => number[] = () => [],
  getTimeInfo: () => { timeZone: string; intraday: boolean } = () => ({ timeZone: "UTC", intraday: true }),
): Coords {
  return {
    priceToY: (p) => series.priceToCoordinate(p),
    yToPrice: (y) => series.coordinateToPrice(y),
    isLog: () => series.priceScale().options().mode === PRICE_SCALE_MODE_LOG,
    // timeToCoordinate / coordinateToTime only map within the loaded data range;
    // off-data x (the empty space to the RIGHT of the last bar — i.e. the
    // future, where drawings should be anchorable just like in TradingView)
    // returns null. We fall back to the logical-index axis, which extends
    // infinitely, and extrapolate a synthetic time off the last bar using the
    // bar interval. Both directions share the same anchor + interval so a future
    // point round-trips (place → project) to the same pixel.
    timeToX: (t) => {
      const x = chart.timeScale().timeToCoordinate(t);
      if (x != null) return x;
      const raw = getRaw();
      if (raw.length === 0) return null;
      const sec = timeAsSec(t);
      if (sec == null) return null;
      const logical = logicalForSec(raw, sec);
      if (logical == null) return null;
      return logicalToX(chart, logical);
    },
    xToTime: (x) => {
      const t = chart.timeScale().coordinateToTime(x);
      if (t != null) return t;
      const raw = getRaw();
      if (raw.length === 0) return null;
      const logical = chart.timeScale().coordinateToLogical(x);
      const lastSec = timeAsSec(raw[raw.length - 1].time);
      if (logical == null || lastSec == null) return null;
      const iv = barIntervalSec(raw);
      if (iv <= 0) return null;
      return Math.round(lastSec + (logical - (raw.length - 1)) * iv) as Time;
    },
    barAt: (t) => nearestBar(getRaw(), t),
    timeToBarIndex: (t) => {
      const raw = getRaw();
      if (raw.length === 0) return null;
      const sec = timeAsSec(t);
      if (sec == null) return null;
      const lastIdx = raw.length - 1;
      const lastSec = timeAsSec(raw[lastIdx].time);
      const firstSec = timeAsSec(raw[0].time);
      const iv = barIntervalSec(raw);
      // Off-data: extrapolate against the nearest edge with the median interval.
      if (lastSec != null && sec > lastSec) return Math.round(lastIdx + (sec - lastSec) / iv);
      if (firstSec != null && sec < firstSec) return Math.round((sec - firstSec) / iv);
      // Within the loaded range: the nearest bar's index (handles gaps).
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < raw.length; i++) {
        const bs = timeAsSec(raw[i].time);
        if (bs == null) continue;
        const d = Math.abs(bs - sec);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    },
    barIndexToTime: (i) => {
      const raw = getRaw();
      if (raw.length === 0) return null;
      if (i >= 0 && i < raw.length) return raw[i].time;
      const lastIdx = raw.length - 1;
      const lastSec = timeAsSec(raw[lastIdx].time);
      if (lastSec == null) return null;
      const iv = barIntervalSec(raw);
      return Math.round(lastSec + (i - lastIdx) * iv) as Time;
    },
    bars: getRaw,
    visibleTimeRange: () => {
      const r = chart.timeScale().getVisibleRange();
      if (!r) return null;
      const from = timeAsSec(r.from);
      const to = timeAsSec(r.to);
      return from == null || to == null ? null : { from, to };
    },
    indicatorValuesAt: (t) => getIndicatorValues(timeAsSec(t)),
    pipSize: () => {
      const pf = series.options().priceFormat;
      return pf && typeof pf.minMove === "number" && pf.minMove > 0 ? pf.minMove : 0.01;
    },
    addPriceLine: (opts) => series.createPriceLine(opts),
    removePriceLine: (line) => series.removePriceLine(line),
    zoomToScreenRect: (x1, x2, y1, y2) => {
      const ts = chart.timeScale();
      const la = ts.coordinateToLogical(Math.min(x1, x2));
      const lb = ts.coordinateToLogical(Math.max(x1, x2));
      if (la != null && lb != null && lb > la) ts.setVisibleLogicalRange({ from: la, to: lb });
      const pa = series.coordinateToPrice(y1);
      const pb = series.coordinateToPrice(y2);
      if (pa != null && pb != null) {
        const lo = Math.min(pa, pb);
        const hi = Math.max(pa, pb);
        if (hi > lo) {
          const ps = series.priceScale();
          ps.setAutoScale(false);
          ps.setVisibleRange({ from: lo, to: hi });
        }
      }
    },
    formatTime: (t) => {
      const f = chart.options().localization.timeFormatter;
      return f ? f(t) : String(t);
    },
    timeInfo: () => getTimeInfo(),
    timeAxis: () => {
      const l = chart.options().layout;
      return { height: chart.timeScale().height(), width: chart.timeScale().width(), fontSize: l.fontSize, fontFamily: l.fontFamily };
    },
  };
}

function timeAsSec(t: Time): number | null {
  if (typeof t === "number") return t;
  if (typeof t === "string") {
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? ms / 1000 : null;
  }
  if (typeof t === "object" && t !== null && "year" in t) {
    return Date.UTC(t.year, t.month - 1, t.day) / 1000;
  }
  return null;
}

/** Median spacing (in seconds) between consecutive bars, used to extrapolate a
 *  time for off-data (future) coordinates. Sampled from the tail so the live
 *  interval wins even if older history was a different resolution; median shrugs
 *  off weekend/holiday gaps. Falls back to one day when too little data. */
function barIntervalSec(raw: OHLC[]): number {
  if (raw.length < 2) return 86400;
  const deltas: number[] = [];
  for (let i = Math.max(1, raw.length - 50); i < raw.length; i++) {
    const a = timeAsSec(raw[i - 1].time);
    const b = timeAsSec(raw[i].time);
    if (a != null && b != null && b > a) deltas.push(b - a);
  }
  if (deltas.length === 0) return 86400;
  deltas.sort((x, y) => x - y);
  return deltas[Math.floor(deltas.length / 2)];
}

/** Fractional logical index (0 = first loaded bar) for an arbitrary time.
 *  `timeToCoordinate` only resolves times that land exactly on a bar, so a
 *  finer-resolution time (e.g. a minute anchor shown on a daily chart) lands
 *  here. Within the loaded range we interpolate between the two bracketing
 *  bars' integer positions — this honours real gaps (weekends/holidays), so a
 *  drawing keeps its place across timeframes. Only off-data (before the first
 *  or after the last bar) do we extrapolate with the median interval, since
 *  there are no real bars to interpolate against. */
function logicalForSec(raw: OHLC[], sec: number): number | null {
  const n = raw.length;
  const firstSec = timeAsSec(raw[0].time);
  const lastSec = timeAsSec(raw[n - 1].time);
  if (firstSec == null || lastSec == null) return null;
  if (sec >= lastSec) {
    const iv = barIntervalSec(raw);
    return iv > 0 ? n - 1 + (sec - lastSec) / iv : null;
  }
  if (sec <= firstSec) {
    const iv = barIntervalSec(raw);
    return iv > 0 ? (sec - firstSec) / iv : null;
  }
  // In range: binary-search the last bar at or before `sec`, then interpolate.
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    const ms = timeAsSec(raw[mid].time);
    if (ms != null && ms <= sec) lo = mid;
    else hi = mid - 1;
  }
  const aSec = timeAsSec(raw[lo].time);
  const bSec = lo + 1 < n ? timeAsSec(raw[lo + 1].time) : null;
  if (aSec == null) return lo;
  if (bSec == null || bSec <= aSec) return lo;
  return lo + (sec - aSec) / (bSec - aSec);
}

/** Pixel x for a (possibly fractional) logical index. lightweight-charts'
 *  `logicalToCoordinate` only returns a correct value for *integer* indices —
 *  a fractional index yields 0 — so we interpolate linearly between the two
 *  bracketing integer indices. The logical axis is uniform in pixels, so this
 *  is exact and gives sub-bar precision (e.g. an intraday time placed partway
 *  through a daily bar). */
function logicalToX(chart: IChartApi, logical: number): number | null {
  const ts = chart.timeScale();
  const lo = Math.floor(logical);
  const cLo = ts.logicalToCoordinate(lo as Logical);
  if (cLo == null) return null;
  const frac = logical - lo;
  if (frac === 0) return cLo;
  const cHi = ts.logicalToCoordinate((lo + 1) as Logical);
  if (cHi == null) return cLo;
  return cLo + frac * (cHi - cLo);
}

/** Shared time→x with the off-bar fallback, for non-drawing renderers (event
 *  markers, etc.) that paint at arbitrary times. Mirrors the `timeToX` method:
 *  try lightweight-charts' exact mapping first, then the gap-aware logical
 *  interpolation. `sec` is UNIX seconds. Returns null with no data. */
export function timeToXFallback(chart: IChartApi, sec: number, bars: OHLC[]): number | null {
  if (bars.length === 0) return null;
  const logical = logicalForSec(bars, sec);
  if (logical == null) return null;
  return logicalToX(chart, logical);
}

function nearestBar(raw: OHLC[], t: Time): OHLC | null {
  if (raw.length === 0) return null;
  const ts = timeAsSec(t);
  if (ts == null) return raw[0];
  let best = raw[0];
  let bestD = Infinity;
  for (const b of raw) {
    const bs = timeAsSec(b.time);
    if (bs == null) continue;
    const d = Math.abs(bs - ts);
    if (d < bestD) {
      best = b;
      bestD = d;
    }
  }
  return best;
}
