/**
 * formatLabel hook: host formatter → Coords → scene builders, with raw numbers.
 * Self-contained harness (mirrors test/labels.test.ts; does not import from it).
 */
import { afterEach, describe, expect, it } from "vitest";
import type { IChartApi, ISeriesApi, SeriesType, Time } from "lightweight-charts";
import {
  DrawingManager,
  defaultStyleFor,
  drawScene,
  hitTestKind,
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
      // stats-row (the row-level label) stays the library join; rewriting it would replace the pieces.
      return label.id === "stats-row" ? undefined : `X:${label.id}`;
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

describe("formatLabel hook (range tools)", () => {
  it("price-range / date-range / date-and-price-range pass raw values through the formatter", () => {
    const lo = 0.00001234;
    const hi = 0.00002468;
    const seen: DrawingLabel[] = [];
    const formatLabel: LabelFormatter = (label) => {
      seen.push(label);
      return `R:${label.id}`;
    };
    const c = baseCoords({
      formatLabel,
      pipSize: () => 1e-8,
      priceToY: (p) => H - p * 1e8,
      yToPrice: (y) => (H - y) / 1e8,
    });

    for (const kind of ["price-range", "date-range", "date-and-price-range"] as const) {
      seen.length = 0;
      const texts = textsOf(drawing(kind, [pt(5, lo), pt(20, hi)]), c);
      expect(texts.every((t) => t.startsWith("R:") || t.includes("R:"))).toBe(true);

      if (kind !== "date-range") {
        const pr = seen.find((l) => l.id === "price-range");
        expect(pr && "change" in pr ? pr.change : undefined).toBe(0.00001234);
        expect(pr && "price0" in pr ? pr.price0 : undefined).toBe(lo);
        expect(pr && "price1" in pr ? pr.price1 : undefined).toBe(hi);
      }
      if (kind !== "price-range") {
        expect(seen.some((l) => l.id === "bars-range" && "bars" in l && l.bars === 15)).toBe(true);
        expect(seen.some((l) => l.id === "time-span" && "seconds" in l && l.seconds === 15 * DAY)).toBe(true);
        expect(seen.some((l) => l.id === "volume" && "volume" in l && typeof l.volume === "number")).toBe(true);
      }
    }

    seen.length = 0;
    textsOf(drawing("price-range", [pt(5, hi), pt(20, lo)]), c);
    const down = seen.find((l) => l.id === "price-range");
    expect(down && "change" in down ? down.change : undefined).toBe(-0.00001234);
  });
});

const POS_PTS = [pt(10, 120), pt(25, 120)] as Drawing["points"];
const POS_LEVELS = { showStats: true, stopLevel: 15, profitLevel: 30 } as const;

const POS_FULL_LONG = [
  "Target: 30.00 (25.000%) 3,000, Amount: 1500",
  "Open PnL: 0.50, Qty: 16",
  "Risk/reward ratio: 2",
  "Stop: 15.00 (12.500%) 1,500, Amount: 750",
];

describe("formatLabel hook (positions)", () => {
  it("long/short full and compact: one label per field with raw numbers; §id replacement", () => {
    const seen: DrawingLabel[] = [];
    const formatLabel: LabelFormatter = (label) => {
      seen.push(label);
      return `\u00A7${label.id}`;
    };
    const c = baseCoords({ formatLabel });

    for (const kind of ["long-position", "short-position"] as const) {
      for (const compact of [false, true]) {
        seen.length = 0;
        const texts = textsOf(drawing(kind, POS_PTS, { ...POS_LEVELS, compactStats: compact }), c);
        expect(texts.every((t) => t.startsWith("\u00A7"))).toBe(true);
        expect(texts.some((t) => t === "\u00A7position-target")).toBe(true);
        expect(texts.some((t) => t === "\u00A7position-stop")).toBe(true);
        expect(texts.some((t) => t === "\u00A7position-middle")).toBe(true);

        const target = seen.find((l) => l.id === "position-target");
        const stop = seen.find((l) => l.id === "position-stop");
        const mid = seen.find((l) => l.id === "position-middle");
        expect(target && "distance" in target ? target.distance : undefined).toBe(30);
        expect(target && "percent" in target ? target.percent : undefined).toBe(25);
        expect(target && "ticks" in target ? target.ticks : undefined).toBe(3000);
        expect(target && "amount" in target ? target.amount : undefined).toBe(1500);
        expect(stop && "distance" in stop ? stop.distance : undefined).toBe(15);
        expect(stop && "percent" in stop ? stop.percent : undefined).toBe(12.5);
        expect(stop && "ticks" in stop ? stop.ticks : undefined).toBe(1500);
        expect(stop && "amount" in stop ? stop.amount : undefined).toBe(750);
        expect(mid && "qty" in mid ? mid.qty : undefined).toBe(16);
        expect(mid && "ratio" in mid ? mid.ratio : undefined).toBe(2);
        expect(mid && "pnl" in mid ? typeof mid.pnl : undefined).toBe("number");
        expect(mid && "closed" in mid ? mid.closed : undefined).toBe(false);

        // Default English text matches characterization (full long as reference).
        if (kind === "long-position" && !compact) {
          expect(target?.text).toBe(POS_FULL_LONG[0]);
          expect(stop?.text).toBe(POS_FULL_LONG[3]);
          expect(mid?.text).toBe(`${POS_FULL_LONG[1]}\n${POS_FULL_LONG[2]}`);
        }
      }
    }
  });

  it("no formatter keeps 0.6.3 position strings", () => {
    const c = baseCoords();
    expect(textsOf(drawing("long-position", POS_PTS, { ...POS_LEVELS, compactStats: false }), c)).toEqual(
      POS_FULL_LONG,
    );
  });
});

describe("formatLabel hook (position-forecast)", () => {
  it("passes raw seconds, prices and forecast-date with timeZone/intraday", () => {
    const seen: DrawingLabel[] = [];
    const formatLabel: LabelFormatter = (label) => {
      seen.push(label);
      return `\u00A7${label.id}`;
    };
    const c = baseCoords({ formatLabel });
    const texts = textsOf(drawing("position-forecast", [pt(10, 110), pt(30, 140)]), c);

    expect(texts.filter((t) => t === "\u00A7price")).toHaveLength(2);
    expect(texts.some((t) => t === "\u00A7forecast")).toBe(true);
    expect(texts.filter((t) => t === "\u00A7forecast-date")).toHaveLength(2);
    // The status banner is a caption (#26).
    expect(texts).toContain("§caption");

    const prices = seen.filter((l) => l.id === "price");
    expect(prices.map((l) => ("price" in l ? l.price : null))).toEqual([110, 140]);
    expect(prices.every((l) => "digits" in l && l.digits === 2)).toBe(true);

    const fc = seen.find((l) => l.id === "forecast");
    expect(fc && "seconds" in fc ? fc.seconds : undefined).toBe(20 * DAY);
    expect(fc && "change" in fc ? fc.change : undefined).toBe(30);
    expect(fc?.text).toBe("30.00 (27.27%) in 20d");

    const dates = seen.filter((l) => l.id === "forecast-date");
    expect(dates).toHaveLength(2);
    expect(dates[0] && "time" in dates[0] ? dates[0].time : undefined).toBe(T0 + 10 * DAY);
    expect(dates[1] && "time" in dates[1] ? dates[1].time : undefined).toBe(T0 + 30 * DAY);
    expect(dates.every((l) => "timeZone" in l && l.timeZone === "UTC")).toBe(true);
    expect(dates.every((l) => "intraday" in l && l.intraday === false)).toBe(true);
    expect(dates[0]?.text).toBe("2026-01-15");
    expect(dates[1]?.text).toBe("2026-02-04");
  });
});

describe("formatLabel hook (fib levels)", () => {
  it("fib-retracement and trend-based-fib-extension pass raw coeff/price/digits", () => {
    const seen: DrawingLabel[] = [];
    const formatLabel: LabelFormatter = (label) => {
      seen.push(label);
      return `\u00A7${label.id}`;
    };
    const c = baseCoords({ formatLabel });

    seen.length = 0;
    const retrace = textsOf(
      drawing("fib-retracement", [pt(15, 103), pt(45, 152)], { showPrices: true, showCoeffs: true }),
      c,
    );
    expect(retrace.length).toBeGreaterThan(0);
    expect(retrace.every((t) => t === "\u00A7fib-level")).toBe(true);
    const zero = seen.find((l) => l.id === "fib-level" && "coeff" in l && l.coeff === 0);
    expect(zero && "price" in zero ? zero.price : undefined).toBe(152);
    expect(zero && "digits" in zero ? zero.digits : undefined).toBe(2);
    expect(zero?.text).toBe("0 (152.00)");
    const mid = seen.find((l) => l.id === "fib-level" && "coeff" in l && l.coeff === 0.5);
    expect(mid && "price" in mid ? mid.price : undefined).toBe(127.5);
    expect(mid?.text).toBe("0.5 (127.50)");

    seen.length = 0;
    const extPts = [pt(10, 100), pt(20, 120), pt(30, 110)] as Drawing["points"];
    const extTexts = textsOf(
      drawing("trend-based-fib-extension", extPts, { showPrices: true, showCoeffs: true }),
      c,
    );
    expect(extTexts.length).toBeGreaterThan(0);
    expect(extTexts.every((t) => t === "\u00A7fib-level")).toBe(true);
    expect(seen.every((l) => l.id === "fib-level" && "coeff" in l && typeof l.coeff === "number")).toBe(true);
    expect(seen.every((l) => "price" in l && l.price != null)).toBe(true);
  });
});

describe("formatLabel hook (channel prices)", () => {
  it("disjoint-channel prices reach the formatter with raw price and digits", () => {
    const seen: DrawingLabel[] = [];
    const formatLabel: LabelFormatter = (label) => {
      seen.push(label);
      return `\u00A7${label.id}`;
    };
    const c = baseCoords({ formatLabel });
    const texts = textsOf(
      drawing("disjoint-channel", [pt(5, 100), pt(30, 130), pt(5, 110)], { showPrices: true }),
      c,
    );
    expect(texts).toEqual(["\u00A7price", "\u00A7price", "\u00A7price", "\u00A7price"]);
    const prices = seen.filter((l) => l.id === "price").map((l) => ("price" in l ? l.price : null));
    expect(prices).toEqual([100, 130, 110, 140]);
    expect(seen.filter((l) => l.id === "price").every((l) => "digits" in l && l.digits === 2)).toBe(true);
    expect(seen.find((l) => l.id === "price")?.text).toBe("100.00");
  });
});

describe("formatLabel hook (price label paint + hit)", () => {
  it("wide formatted price-label hits beyond the default box width", () => {
    const price = 0.00001234;
    const seen: DrawingLabel[] = [];
    const formatLabel: LabelFormatter = (label) => {
      seen.push(label);
      // Three times the default string → painted/hit box grows with measureText.
      return label.text + label.text + label.text;
    };
    const c = baseCoords({
      formatLabel,
      pipSize: () => 1e-8,
      priceToY: (p) => H - p * 1e8,
      yToPrice: (y) => (H - y) / 1e8,
    });
    const d = drawing("price-label", [pt(20, price)]);
    const pts = project(d, c);
    const fs = d.style.fontSize ?? 14;
    const defaultText = price.toFixed(8);
    // measureTextStyled falls back to length * fs * 0.6 when canvas ctx is null.
    const defaultW = defaultText.length * fs * 0.6 + 20;
    const boxX = pts[0].x + 9;
    const boxH = fs + 10;
    const boxY = pts[0].y - (boxH + 15);
    // Just past the default box's right edge, still inside a 3×-wide box.
    const cursor = { x: boxX + defaultW + 5, y: boxY + boxH / 2 };

    expect(hitTestKind(d, pts, cursor, W, H, c)).toEqual({ hit: "body" });

    const pl = seen.find((l) => l.id === "price");
    expect(pl && "price" in pl ? pl.price : undefined).toBe(price);
    expect(pl && "digits" in pl ? pl.digits : undefined).toBe(8);
    expect(pl?.text).toBe(defaultText);
  });

  it("price-note: raw price + digits; default text matches characterization", () => {
    const seen: DrawingLabel[] = [];
    const formatLabel: LabelFormatter = (label) => {
      seen.push(label);
      return `\u00A7${label.id}`;
    };
    const c = baseCoords({ formatLabel });
    const texts = textsOf(drawing("price-note", [pt(20, 1234.56), pt(25, 1300)], { text: "" }), c);
    expect(texts).toEqual(["\u00A7price"]);
    const pl = seen.find((l) => l.id === "price");
    expect(pl && "price" in pl ? pl.price : undefined).toBe(1234.56);
    expect(pl && "digits" in pl ? pl.digits : undefined).toBe(2);
    expect(pl?.text).toBe("1234.56");
  });
});

describe("formatLabel hook (regression / volume profile / gann)", () => {
  it("regression-trend: Pearson's R reaches the formatter as raw r", () => {
    const seen: DrawingLabel[] = [];
    const formatLabel: LabelFormatter = (label) => {
      seen.push(label);
      return `\u00A7${label.id}`;
    };
    const c = baseCoords({ formatLabel });
    const texts = textsOf(drawing("regression-trend", [pt(5, 100), pt(40, 140)], { showPearsons: true }), c);
    expect(texts).toEqual(["\u00A7pearson"]);
    const p = seen.find((l) => l.id === "pearson");
    expect(p && "r" in p ? p.r : undefined).toBe(0.9028568950984005);
    expect(p?.text).toBe("0.9028568950984005");
  });

  it("fixed-range-volume-profile: raw volume reaches the formatter", () => {
    const seen: DrawingLabel[] = [];
    const formatLabel: LabelFormatter = (label) => {
      seen.push(label);
      return `\u00A7${label.id}`;
    };
    const c = baseCoords({ formatLabel });
    const texts = textsOf(
      drawing("fixed-range-volume-profile", [pt(5, 90), pt(40, 160)], {
        vp: { showValues: true, rows: 8 },
      } as Partial<DrawingStyle>),
      c,
    );
    expect(texts.every((t) => t === "\u00A7volume")).toBe(true);
    expect(texts).toHaveLength(8);
    const vols = seen.filter((l) => l.id === "volume").map((l) => ("volume" in l ? l.volume : null));
    expect(vols.every((v) => typeof v === "number")).toBe(true);
    expect(seen[0]?.text).toBe("1.22M");
  });

  it("gann-square: ratio reaches the formatter as a raw number", () => {
    const seen: DrawingLabel[] = [];
    const formatLabel: LabelFormatter = (label) => {
      seen.push(label);
      return `\u00A7${label.id}`;
    };
    const c = baseCoords({ formatLabel });
    const texts = textsOf(drawing("gann-square", [pt(5, 100), pt(25, 140)], { showLabels: true }), c);
    expect(texts.every((t) => t.startsWith("\u00A7"))).toBe(true);
    const ratio = seen.find((l) => l.id === "gann-ratio");
    expect(ratio && "ratio" in ratio ? ratio.ratio : undefined).toBe(2);
    expect(ratio?.text).toBe("2");
  });
});

describe("formatLabel coverage: every characterized kind is hookable", () => {
  /** Same drawings as test/labels.test.ts (copied, not imported). */
  const CASES: { kind: string; d: Drawing }[] = [
    {
      kind: "trend-line",
      d: drawing("trend-line", [pt(5, 1500), pt(20, 1000)], ALL_STATS),
    },
    { kind: "price-range", d: drawing("price-range", [pt(5, 1500), pt(20, 1000)]) },
    { kind: "date-range", d: drawing("date-range", [pt(5, 1500), pt(20, 1000)]) },
    { kind: "date-and-price-range", d: drawing("date-and-price-range", [pt(5, 1500), pt(20, 1000)]) },
    {
      kind: "long-position-full",
      d: drawing("long-position", POS_PTS, { ...POS_LEVELS, compactStats: false }),
    },
    {
      kind: "long-position-compact",
      d: drawing("long-position", POS_PTS, { ...POS_LEVELS, compactStats: true }),
    },
    {
      kind: "short-position-full",
      d: drawing("short-position", POS_PTS, { ...POS_LEVELS, compactStats: false }),
    },
    {
      kind: "short-position-compact",
      d: drawing("short-position", POS_PTS, { ...POS_LEVELS, compactStats: true }),
    },
    { kind: "position-forecast", d: drawing("position-forecast", [pt(10, 110), pt(30, 140)]) },
    {
      kind: "fib-retracement",
      d: drawing("fib-retracement", [pt(15, 103), pt(45, 152)], { showPrices: true, showCoeffs: true }),
    },
    {
      kind: "regression-trend",
      d: drawing("regression-trend", [pt(5, 100), pt(40, 140)], { showPearsons: true }),
    },
    {
      kind: "fixed-range-volume-profile",
      d: drawing("fixed-range-volume-profile", [pt(5, 90), pt(40, 160)], {
        vp: { showValues: true, rows: 8 },
      } as Partial<DrawingStyle>),
    },
    { kind: "price-note", d: drawing("price-note", [pt(20, 1234.56), pt(25, 1300)], { text: "" }) },
    { kind: "price-label", d: drawing("price-label", [pt(20, 1234.56)]) },
    {
      kind: "disjoint-channel",
      d: drawing("disjoint-channel", [pt(5, 100), pt(30, 130), pt(5, 110)], { showPrices: true }),
    },
    {
      kind: "gann-square",
      d: drawing("gann-square", [pt(5, 100), pt(25, 140)], { showLabels: true }),
    },
  ];

  it("formatter §id rewrites every library-built text of characterized kinds", () => {
    const formatLabel: LabelFormatter = (label) => `\u00A7${label.id}`;
    const c = baseCoords({ formatLabel });
    // SUCCESS / FAILURE stay library English (54-04); not in the label inventory.
    const allow = new Set(["SUCCESS", "FAILURE"]);
    const leaks: string[] = [];
    for (const { kind, d } of CASES) {
      for (const t of textsOf(d, c)) {
        if (allow.has(t)) continue;
        if (!t.startsWith("\u00A7")) leaks.push(`${kind}: ${JSON.stringify(t)}`);
      }
    }
    expect(leaks, leaks.join("; ")).toEqual([]);
  });
});

describe("formatLabel empty-string edge", () => {
  function recordingCtx(): CanvasRenderingContext2D {
    const handler: ProxyHandler<object> = {
      get(_t, prop) {
        if (prop === "canvas") return { width: W, height: H };
        if (prop === "getTransform") return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
        return (..._args: unknown[]) => {
          if (String(prop).toLowerCase().includes("gradient")) return new Proxy({}, handler);
          return undefined;
        };
      },
      set: () => true,
    };
    return new Proxy({}, handler) as CanvasRenderingContext2D;
  }

  it("formatter returning \"\" does not throw; labels draw empty; drawScene survives", () => {
    // Node has no Path2D; drawScene constructs one for clips / fills.
    (globalThis as { Path2D?: unknown }).Path2D ??= class {
      rect() {}
      moveTo() {}
      lineTo() {}
      closePath() {}
      arc() {}
      ellipse() {}
      addPath() {}
    };
    const c = baseCoords({ formatLabel: () => "" });
    const kinds: Drawing["kind"][] = ["trend-line", "price-range", "date-range", "date-and-price-range"];
    for (const kind of kinds) {
      const d =
        kind === "trend-line"
          ? drawing(kind, [pt(5, 1500), pt(20, 1000)], ALL_STATS)
          : drawing(kind, [pt(5, 1500), pt(20, 1000)]);
      let scene!: Scene;
      expect(() => {
        scene = sceneOf(d, project(d, c), { w: W, h: H, coords: c, selected: true });
      }).not.toThrow();
      const labelTexts = flat(scene)
        .filter((it): it is Extract<SceneItem, { t: "text" }> => it.t === "text")
        .map((it) => it.text);
      // Hooked labels are empty; custom/user text (if any) is out of scope.
      expect(labelTexts.every((t) => t === "")).toBe(true);
      expect(() =>
        drawScene(recordingCtx(), scene, {
          fontFamily: "sans-serif",
          anchors: { fillAt: () => "#000", selected: true },
        }),
      ).not.toThrow();
    }
  });
});
