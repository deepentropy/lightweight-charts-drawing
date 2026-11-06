/**
 * formatLabel hook: host formatter → Coords → scene builders, with raw numbers.
 * Self-contained harness (mirrors test/labels.test.ts; does not import from it).
 */
import { afterEach, describe, expect, it } from "vitest";
import type { IChartApi, ISeriesApi, SeriesType, Time } from "lightweight-charts";
import {
  DrawingManager,
  defaultStyleFor,
  sceneOf,
  type Coords,
  type Drawing,
  type DrawingLabel,
  type DrawingStyle,
  type LabelFormatter,
  type OHLC,
  type Scene,
  type SceneItem,
} from "lightweight-charts-drawing";

(globalThis as { document?: unknown }).document ??= {
  createElement: () => ({ getContext: () => null }),
  addEventListener() {},
  removeEventListener() {},
};

const W = 800;
const H = 500;
const SP = 10;
const DAY = 86400;
const T0 = Date.UTC(2026, 0, 5) / 1000;

const bars: OHLC[] = Array.from({ length: 60 }, (_, i) => {
  const mid = i <= 15 ? 120 - i : i <= 45 ? 105 + (i - 15) * 1.5 : 150 - (i - 45);
  return {
    time: (T0 + i * DAY) as Time,
    open: mid - 0.5,
    high: mid + 2,
    low: mid - 2,
    close: mid + 0.5,
    volume: 50_000 + i * 12_345,
  };
});

function baseCoords(extra: Partial<Coords> = {}): Coords {
  return {
    priceToY: (p) => H - (p - 80) * 5,
    yToPrice: (y) => 80 + (H - y) / 5,
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
    ...extra,
  };
}

function pt(i: number, price: number) {
  return { time: bars[i].time, price };
}

function drawing(kind: Drawing["kind"], points: Drawing["points"], style?: Partial<DrawingStyle>): Drawing {
  return {
    id: `dw_${kind}`,
    kind,
    points,
    style: { ...defaultStyleFor(kind), ...style },
  } as Drawing;
}

function project(d: Drawing, c: Coords) {
  return d.points.map((p) => ({ x: c.timeToX(p.time)!, y: c.priceToY(p.price)! }));
}

function flat(s: Scene): SceneItem[] {
  return s.flatMap((it) => (it.t === "group" ? flat(it.items) : [it]));
}

function textsOf(d: Drawing, c: Coords, selected = false): string[] {
  return flat(sceneOf(d, project(d, c), { w: W, h: H, coords: c, selected }))
    .filter((it): it is Extract<SceneItem, { t: "text" }> => it.t === "text")
    .map((it) => it.text);
}

const ALL_STATS: Partial<DrawingStyle> = {
  showStats: true,
  showPriceRange: true,
  showPercentPriceRange: true,
  showPipsPriceRange: true,
  showBarsRange: true,
  showDateTimeRange: true,
  showDistance: true,
  showAngle: true,
};

const TREND_DEFAULTS = [
  "\u2212500.00 (\u221233.33%), \u221250000",
  "15 bars (15d), distance: 2504 px",
  "-86.57\u00ba",
];

function installWindow(): void {
  const target = new EventTarget();
  (globalThis as { window?: EventTarget }).window = target;
}

function fakeChart() {
  const el = new EventTarget() as EventTarget & { getBoundingClientRect: () => DOMRect };
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 800, bottom: 500, width: 800, height: 500, x: 0, y: 0, toJSON() { return {}; } });
  const chartBars = [
    { time: 1_700_000_000 as Time, open: 1, high: 2, low: 0.5, close: 1.5 },
    { time: 1_700_000_060 as Time, open: 1.5, high: 2.5, low: 1, close: 2 },
  ];
  const opts = {
    handleScroll: { horzTouchDrag: true },
    handleScale: { pinch: true },
    layout: { fontFamily: "sans-serif", background: { color: "#000" } },
    localization: {},
  };
  const chart = {
    chartElement: () => el,
    options: () => opts,
    applyOptions: () => {},
    timeScale: () => ({
      timeToCoordinate: (t: Time) => {
        const i = chartBars.findIndex((b) => b.time === t);
        return i < 0 ? null : i * 10;
      },
      coordinateToTime: () => null,
      coordinateToLogical: (x: number) => x / 10,
      logicalToCoordinate: (l: number) => l * 10,
    }),
  } as unknown as IChartApi;
  const series = {
    attachPrimitive() {},
    detachPrimitive() {},
    data: () => chartBars,
    getPane: () => ({ paneIndex: () => 0, getHTMLElement: () => el }),
    priceToCoordinate: (p: number) => 500 - p * 10,
    coordinateToPrice: (y: number) => (500 - y) / 10,
    priceScale: () => ({ options: () => ({ mode: 0 }), width: () => 0 }),
    options: () => ({}),
  } as unknown as ISeriesApi<SeriesType>;
  return { chart, series };
}

describe("formatLabel hook (trend-line stats)", () => {
  const managers: DrawingManager[] = [];
  afterEach(() => {
    for (const m of managers.splice(0)) m.destroy();
  });

  it("rewrites every stats-badge id and records default English text", () => {
    const seen: DrawingLabel[] = [];
    const formatLabel: LabelFormatter = (label) => {
      seen.push(label);
      return `X:${label.id}`;
    };
    const c = baseCoords({ formatLabel });
    const texts = textsOf(drawing("trend-line", [pt(5, 1500), pt(20, 1000)], ALL_STATS), c);
    expect(texts.some((t) => t.includes("X:price-range"))).toBe(true);
    expect(texts.some((t) => t.includes("X:bars-range"))).toBe(true);
    expect(texts.some((t) => t.includes("X:time-span"))).toBe(true);
    expect(texts.some((t) => t.includes("X:distance"))).toBe(true);
    expect(texts.some((t) => t.includes("X:angle"))).toBe(true);
    expect(texts.every((t) => !TREND_DEFAULTS.includes(t))).toBe(true);

    const byId = Object.fromEntries(seen.map((l) => [l.id, l]));
    expect(byId["price-range"]?.text).toBe(TREND_DEFAULTS[0]);
    expect(byId["bars-range"]?.text).toBe("15 bars");
    expect(byId["time-span"]?.text).toBe("15d");
    expect(byId["distance"]?.text).toBe("distance: 2504 px");
    expect(byId["angle"]?.text).toBe(TREND_DEFAULTS[2]);
  });

  it("hands the formatter raw unrounded change (±0.00001234) and prices", () => {
    const lo = 0.00001234;
    const hi = 0.00002468;
    const seen: DrawingLabel[] = [];
    const formatLabel: LabelFormatter = (label) => {
      seen.push(label);
      return label.text;
    };
    const c = baseCoords({
      formatLabel,
      pipSize: () => 1e-8,
      priceToY: (p) => H - p * 1e8,
      yToPrice: (y) => (H - y) / 1e8,
    });

    textsOf(drawing("trend-line", [pt(5, hi), pt(20, lo)], { ...ALL_STATS, showBarsRange: false, showDateTimeRange: false, showDistance: false, showAngle: false }), c);
    const down = seen.find((l) => l.id === "price-range");
    expect(down && "change" in down ? down.change : undefined).toBe(-0.00001234);
    expect(down && "price0" in down ? down.price0 : undefined).toBe(hi);
    expect(down && "price1" in down ? down.price1 : undefined).toBe(lo);

    seen.length = 0;
    textsOf(drawing("trend-line", [pt(5, lo), pt(20, hi)], { ...ALL_STATS, showBarsRange: false, showDateTimeRange: false, showDistance: false, showAngle: false }), c);
    const up = seen.find((l) => l.id === "price-range");
    expect(up && "change" in up ? up.change : undefined).toBe(0.00001234);
    expect(up && "price0" in up ? up.price0 : undefined).toBe(lo);
    expect(up && "price1" in up ? up.price1 : undefined).toBe(hi);
  });

  it("undefined / null formatter returns keep the 0.6.3 strings", () => {
    for (const ret of [undefined, null] as const) {
      const c = baseCoords({ formatLabel: () => ret });
      expect(textsOf(drawing("trend-line", [pt(5, 1500), pt(20, 1000)], ALL_STATS), c)).toEqual(TREND_DEFAULTS);
    }
  });

  it("DrawingManager puts formatLabel on the coords its scenes use", () => {
    installWindow();
    const formatLabel: LabelFormatter = (l) => `M:${l.id}`;
    const { chart, series } = fakeChart();
    const dm = new DrawingManager(chart, series, { formatLabel });
    managers.push(dm);
    const coords = (dm as unknown as { coords: Coords }).coords;
    expect(coords.formatLabel).toBe(formatLabel);
  });
});
