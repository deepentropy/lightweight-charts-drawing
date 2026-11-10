/**
 * Drawings writing numbers (#29), shared by the number-format tests: a fake
 * coords over 60 daily bars and the texts a drawing draws.
 */
import type { Time } from "lightweight-charts";
import { defaultStyleFor, sceneOf, type Coords, type Drawing, type DrawingStyle, type OHLC, type Scene, type SceneItem } from "lightweight-charts-drawing";

(globalThis as { document?: unknown }).document ??= {
  createElement: () => ({ getContext: () => null }),
  addEventListener() {},
  removeEventListener() {},
};

const W = 800;
const H = 500;
const SP = 10;
const DAY = 86400;
const T0 = Date.UTC(2020, 0, 6) / 1000;

const bars: OHLC[] = Array.from({ length: 60 }, (_, i) => {
  const mid = 1200 + i * 3;
  return { time: (T0 + i * DAY) as Time, open: mid - 0.5, high: mid + 2, low: mid - 2, close: mid + 0.5, volume: 1_000_000 + i * 2_345_678 };
});

function coords(): Coords {
  return {
    priceToY: (p) => H - (p - 1100) * 1.5,
    yToPrice: (y) => 1100 + (H - y) / 1.5,
    isLog: () => false,
    timeToX: (t) => (((t as number) - T0) / DAY) * SP,
    xToTime: (x) => (T0 + Math.round(x / SP) * DAY) as Time,
    barAt: (t) => bars.find((b) => b.time === t) ?? null,
    timeToBarIndex: (t) => Math.round(((t as number) - T0) / DAY),
    barIndexToTime: (i) => (T0 + i * DAY) as Time,
    bars: () => bars,
    visibleTimeRange: () => ({ from: T0, to: T0 + 59 * DAY }),
    indicatorValuesAt: () => [],
    pipSize: () => 0.01,
    addPriceLine: () => {
      throw new Error("not used");
    },
    removePriceLine: () => {},
    zoomToScreenRect: () => {},
    formatTime: (t) => new Date((t as number) * 1000).toISOString().slice(0, 10),
    timeAxis: () => ({ height: 28, width: W, fontSize: 12, fontFamily: "sans-serif" }),
    timeInfo: () => ({ timeZone: "UTC", intraday: false }),
  };
}

const pt = (day: number, price: number) => ({ time: (T0 + day * DAY) as Time, price });

function drawing(kind: Drawing["kind"], points: Drawing["points"], style?: Partial<DrawingStyle>): Drawing {
  return { id: `dw_${kind}`, kind, points, style: { ...defaultStyleFor(kind), ...style } } as Drawing;
}

function flat(s: Scene): SceneItem[] {
  return s.flatMap((it) => (it.t === "group" ? flat(it.items) : [it]));
}

/** Every text the drawing draws. */
export function textsOf(d: Drawing): string[] {
  const c = coords();
  const pts = d.points.map((p) => ({ x: c.timeToX(p.time)!, y: c.priceToY(p.price)! }));
  return flat(sceneOf(d, pts, { w: W, h: H, coords: c, selected: false }))
    .filter((it): it is Extract<SceneItem, { t: "text" }> => it.t === "text")
    .map((it) => it.text);
}

const STATS: Partial<DrawingStyle> = {
  showStats: true,
  showPriceRange: true,
  showPercentPriceRange: true,
  showPipsPriceRange: true,
  showBarsRange: true,
  showDateTimeRange: true,
  showDistance: true,
  showAngle: true,
};

/** The drawings of the number-format tests. */
export const CASES: [string, Drawing][] = [
  ["trend line, falling, 1,500 days", drawing("trend-line", [pt(5, 1500.5), pt(1505, 1234.25)], STATS)],
  ["trend line, right to left", drawing("trend-line", [pt(30, 1250), pt(10, 1300)], STATS)],
  ["trend angle", drawing("trend-angle", [pt(5, 1250), pt(20, 1300)])],
  ["date and price range", drawing("date-and-price-range", [pt(2, 1210), pt(40, 1325.75)])],
  ["long position", drawing("long-position", [pt(10, 1250), pt(30, 1250)], { showStats: true, stopLevel: 1550, profitLevel: 150000 })],
  ["short position, compact", drawing("short-position", [pt(10, 1250), pt(30, 1250)], { showStats: true, stopLevel: 1550, profitLevel: 3000, compactStats: true })],
  ["position forecast", drawing("position-forecast", [pt(10, 1250), pt(40, 1230.5)])],
  ["price note", drawing("price-note", [pt(10, 1234.5), pt(20, 1300)])],
  ["price label", drawing("price-label", [pt(10, 1234.5)])],
  ["fib retracement", drawing("fib-retracement", [pt(5, 1200), pt(30, 1350)])],
  ["fib retracement in percents", drawing("fib-retracement", [pt(5, 1200), pt(30, 1350)], { fibLevelsAsPercents: true })],
  ["fib channel", drawing("fib-channel", [pt(5, 1200), pt(30, 1250), pt(10, 1300)])],
  ["fib time zone", drawing("fib-time-zone", [pt(5, 1200), pt(10, 1250)])],
  ["gann square", drawing("gann-square", [pt(5, 1200), pt(30, 1350)])],
  ["gann box", drawing("gann-box", [pt(5, 1200), pt(30, 1350)])],
  ["disjoint channel with prices", drawing("disjoint-channel", [pt(5, 1200), pt(30, 1250), pt(5, 1300)], { showPrices: true })],
  ["abcd pattern", drawing("abcd-pattern", [pt(5, 1200), pt(10, 1300), pt(15, 1240), pt(20, 1330)])],
  ["regression trend", drawing("regression-trend", [pt(5, 1200), pt(40, 1300)])],
];
