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
import type { Coords, OHLC } from "../core/coords";

/** lightweight-charts PriceScaleMode.Logarithmic (a const enum value; not
 *  imported so no lightweight-charts runtime is pulled in). */
const PRICE_SCALE_MODE_LOG = 1;

/** The symbol's trading calendar around the loaded bars (the host knows the sessions). The time scale continues
 *  after the last bar with the bars the symbol would open: the rest of the session, then the next sessions (nights,
 *  weekends and holidays skipped); before the first loaded bar it counts the bars the symbol had. Times are epoch
 *  seconds. A time is drawn on the bar that holds it (the last bar opening at or before it). */
export type FutureAxis = {
  /** Future bars that open after `lastTime` and at or before `time` (0 = still on the last bar). */
  slots: (time: number, lastTime: number) => number;
  /** Open time of the k-th future bar (k >= 1), null past the host's range. */
  time: (k: number, lastTime: number) => number | null;
  /** Bars from the bar that holds `time` to the first loaded bar (opening at `firstTime`), that bar counted
   *  (>= 1 for a time before the first bar). Absent = calendar time with the median bar interval. */
  pastSlots?: (time: number, firstTime: number) => number;
  /** Open time of the k-th bar before the first loaded bar (k >= 1), null past the host's range. Give it with
   *  `pastSlots`. */
  pastTime?: (k: number, firstTime: number) => number | null;
  /** Where a time sits when the bar that holds it is looked for, non-decreasing over the bar times. The host maps a
   *  daily bar time to its session open (the reference opens a daily bar there: a pre-market time belongs to the
   *  previous daily bar, a point drawn on a daily bar goes to the first intraday bar of its day). Identity when
   *  absent. */
  timeKey?: (time: number) => number;
};

export function makeCoords(
  chart: IChartApi,
  series: ISeriesApi<SeriesType>,
  getRaw: () => OHLC[],
  /** Resolves overlay-indicator values at an epoch-seconds bar time. Injected
   *  by ChartView (reads the live IndicatorController); defaults to none. */
  getIndicatorValues: (sec: number | null) => number[] = () => [],
  getTimeInfo: () => { timeZone: string; intraday: boolean } = () => ({ timeZone: "UTC", intraday: true }),
  /** Future bars on the trading calendar; null (or absent) = calendar time extrapolated with the bar interval. */
  getFuture: () => FutureAxis | null = () => null,
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
    // point round-trips (place → project) to the same pixel. With the host's
    // future axis a future time sits on the future bar that holds it and an x
    // gives the open time of its nearest future bar.
    timeToX: (t) => {
      const x = chart.timeScale().timeToCoordinate(t);
      if (x != null) return x;
      const raw = getRaw();
      if (raw.length === 0) return null;
      const sec = timeAsSec(t);
      if (sec == null) return null;
      const logical = logicalForSec(raw, sec, getFuture());
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
      const future = getFuture();
      if (future && logical > raw.length - 1) {
        const k = Math.round(logical - (raw.length - 1));
        if (k <= 0) return raw[raw.length - 1].time;
        const ft = future.time(k, lastSec);
        if (ft != null) return ft as Time;
      }
      const firstSec = timeAsSec(raw[0].time);
      if (future?.pastTime && firstSec != null && logical < 0) {
        const k = Math.round(-logical);
        if (k <= 0) return raw[0].time;
        const pt = future.pastTime(k, firstSec);
        if (pt != null) return pt as Time;
      }
      const iv = barIntervalSec(raw);
      if (iv <= 0) return null;
      // Right of the last bar: the open time of the nearest whole future bar, so the point lands where it was placed.
      if (logical > raw.length - 1) return (lastSec + Math.max(1, Math.round(logical - (raw.length - 1))) * iv) as Time;
      return Math.round(lastSec + (logical - (raw.length - 1)) * iv) as Time;
    },
    barAt: (t) => nearestBar(getRaw(), t),
    timeToBarIndex: (t) => {
      const raw = getRaw();
      if (raw.length === 0) return null;
      const sec = timeAsSec(t);
      if (sec == null) return null;
      // The bar that holds the time (off the loaded bars: counted on the host's calendar, else rounded calendar time).
      const logical = logicalForSec(raw, sec, getFuture());
      return logical == null ? null : Math.round(logical);
    },
    barIndexToTime: (i) => {
      const raw = getRaw();
      if (raw.length === 0) return null;
      if (i >= 0 && i < raw.length) return raw[i].time;
      const lastIdx = raw.length - 1;
      const lastSec = timeAsSec(raw[lastIdx].time);
      if (lastSec == null) return null;
      const future = getFuture();
      if (future && i > lastIdx) {
        const ft = future.time(i - lastIdx, lastSec);
        if (ft != null) return ft as Time;
      }
      const firstSec = timeAsSec(raw[0].time);
      if (future?.pastTime && firstSec != null && i < 0) {
        const pt = future.pastTime(-i, firstSec);
        if (pt != null) return pt as Time;
      }
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
      if (f) return f(t);
      // No host formatter: a crosshair-like label, "29 Oct '25   13:30" (the
      // time only when the time scale shows it), in the chart locale, UTC.
      const sec = timeAsSec(t);
      if (sec == null) return String(t);
      const o = chart.options();
      const d = new Date(sec * 1000);
      const mon = new Intl.DateTimeFormat(o.localization.locale, { month: "short", timeZone: "UTC" }).format(d);
      const date = `${d.getUTCDate()} ${mon} '${String(d.getUTCFullYear() % 100).padStart(2, "0")}`;
      if (!o.timeScale.timeVisible) return date;
      const two = (n: number) => String(n).padStart(2, "0");
      const time = `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}${o.timeScale.secondsVisible ? `:${two(d.getUTCSeconds())}` : ""}`;
      return `${date}   ${time}`;
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

/** Logical index (0 = first loaded bar) of an arbitrary time: the bar that
 *  holds it. `timeToCoordinate` only resolves times that land exactly on a
 *  bar, so a time of another interval (e.g. a 5 minute point shown on a 1 hour
 *  chart) lands here. The reference draws points on whole bars: a time between
 *  two bars, in a gap between sessions included, is on the last bar opening at
 *  or before it (compared with the host's `timeKey`). The stored time is kept,
 *  so the point comes back to its own bar on its own interval. Off the loaded
 *  bars the host's calendar counts the bars; without it, calendar time with the
 *  median bar interval: whole bars after the last one (a time in the open last
 *  bar stays on it), fractional before the first. */
function logicalForSec(raw: OHLC[], sec: number, future?: FutureAxis | null): number | null {
  const n = raw.length;
  const firstSec = timeAsSec(raw[0].time);
  const lastSec = timeAsSec(raw[n - 1].time);
  if (firstSec == null || lastSec == null) return null;
  const key = future?.timeKey ?? ((t: number) => t);
  const k = key(sec);
  if (k >= key(lastSec)) {
    if (future) return n - 1 + future.slots(sec, lastSec);
    if (sec <= lastSec) return n - 1;
    const iv = barIntervalSec(raw);
    // A time in the still-open last bar stays on it; later times sit on the whole future bar that holds them.
    return iv > 0 ? n - 1 + Math.floor((sec - lastSec) / iv) : null;
  }
  if (k < key(firstSec)) {
    if (future?.pastSlots) return -future.pastSlots(sec, firstSec);
    const iv = barIntervalSec(raw);
    return iv > 0 ? (sec - firstSec) / iv : null;
  }
  return holderIndex(raw, k, key);
}

/** Index of the bar that holds a time of key `k` (the last bar whose key is at or before it), for a time within the
 *  loaded range. */
function holderIndex(raw: OHLC[], k: number, key: (t: number) => number): number {
  let lo = 0;
  let hi = raw.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    const ms = timeAsSec(raw[mid].time);
    if (ms != null && key(ms) <= k) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Pixel x for a (possibly fractional) logical index. lightweight-charts'
 *  `logicalToCoordinate` only returns a correct value for *integer* indices —
 *  a fractional index yields 0 — so we interpolate linearly between the two
 *  bracketing integer indices. The logical axis is uniform in pixels, so this
 *  is exact (used off the loaded bars without a host calendar, where calendar
 *  time gives fractional indices). */
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
 *  try lightweight-charts' exact mapping first, then the bar that holds the
 *  time (off the loaded bars: the host's calendar `future` when given).
 *  `sec` is UNIX seconds. Returns null with no data. */
export function timeToXFallback(chart: IChartApi, sec: number, bars: OHLC[], future?: FutureAxis | null): number | null {
  if (bars.length === 0) return null;
  const logical = logicalForSec(bars, sec, future);
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
