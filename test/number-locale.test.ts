/**
 * numberLocale option: numbers the library draws itself follow a host locale;
 * unset = the fixed EN text, byte for byte. Self-contained harness (mirrors
 * test/labels-hook.test.ts; does not import from it).
 */
import { afterEach, describe, expect, it } from "vitest";
import type { IChartApi, ISeriesApi, SeriesType, Time } from "lightweight-charts";
import {
  DrawingManager,
  defaultStyleFor,
  sceneOf,
  type Coords,
  type Drawing,
  type DrawingStyle,
  type LabelFormatter,
  type OHLC,
  type Scene,
  type SceneItem,
} from "lightweight-charts-drawing";
import { formatNumber } from "../src/core/number-format";
import { tvTimeSpan, tvVolume } from "../src/core/scene/text";

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
  return { id: `dw_${kind}`, kind, points, style: { ...defaultStyleFor(kind), ...style } } as Drawing;
}

function project(d: Drawing, c: Coords) {
  return d.points.map((p) => ({ x: c.timeToX(p.time)!, y: c.priceToY(p.price)! }));
}

function flat(s: Scene): SceneItem[] {
  return s.flatMap((it) => (it.t === "group" ? flat(it.items) : [it]));
}

function textsOf(d: Drawing, c: Coords): string[] {
  return flat(sceneOf(d, project(d, c), { w: W, h: H, coords: c, selected: false }))
    .filter((it): it is Extract<SceneItem, { t: "text" }> => it.t === "text")
    .map((it) => it.text);
}

function fakeChart() {
  const el = new EventTarget() as EventTarget & { getBoundingClientRect: () => object };
  el.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 500, width: 800, height: 500 });
  const chartBars = [
    { time: 1_700_000_000 as Time, open: 1, high: 2, low: 0.5, close: 1.5 },
    { time: 1_700_000_060 as Time, open: 1.5, high: 2.5, low: 1, close: 2 },
  ];
  const chart = {
    chartElement: () => el,
    options: () => ({ handleScroll: {}, handleScale: {}, layout: { fontFamily: "sans-serif" }, localization: {} }),
    applyOptions: () => {},
    timeScale: () => ({
      timeToCoordinate: (t: Time) => {
        const i = chartBars.findIndex((b) => b.time === t);
        return i < 0 ? null : i * 100 + 50;
      },
      coordinateToTime: () => null,
      coordinateToLogical: (x: number) => x / 100,
      logicalToCoordinate: (l: number) => l * 100,
    }),
  } as unknown as IChartApi;
  const series = {
    attachPrimitive() {},
    detachPrimitive() {},
    data: () => chartBars,
    getPane: () => ({ paneIndex: () => 0, getHTMLElement: () => el }),
    priceToCoordinate: (p: number) => 500 - p * 100,
    coordinateToPrice: (y: number) => (500 - y) / 100,
    priceScale: () => ({ options: () => ({ mode: 0 }), width: () => 0 }),
    options: () => ({}),
  } as unknown as ISeriesApi<SeriesType>;
  return { chart, series };
}

const angleLine = (angle: number) => drawing("trend-angle", [pt(5, 1500), pt(20, 1000)], { angle });

describe("formatNumber", () => {
  it("null / unset coords return the fallback untouched", () => {
    expect(formatNumber(null, 0.5, { min: 0, max: 2 }, "0.5")).toBe("0.5");
    expect(formatNumber({}, 1234.5, { min: 2, max: 2 }, "1234.50")).toBe("1234.50");
  });

  it("an invalid locale tag falls back instead of throwing", () => {
    expect(formatNumber({ numberLocale: "not a locale!" }, 1.5, { min: 0, max: 2 }, "1.5")).toBe("1.5");
  });

  it("a well-formed tag with no locale data falls back too (never the runtime locale)", () => {
    expect(formatNumber({ numberLocale: "zz" }, 1234.5, { min: 2, max: 2 }, "1234.50")).toBe("1234.50");
    expect(formatNumber({ numberLocale: "ua" }, 1234.5, { min: 2, max: 2 }, "1234.50")).toBe("1234.50");
  });

  it("a set locale formats with the digit bounds", () => {
    expect(formatNumber({ numberLocale: "uk-UA" }, 12.3, { min: 2, max: 2 }, "12.30")).toBe("12,30");
    expect(formatNumber({ numberLocale: "en" }, 12.3456, { min: 0, max: 2 }, "x")).toBe("12.35");
  });
});

describe("numberLocale: trend angle arc", () => {
  it("unset keeps the v0.8.0 text, negative angle included", () => {
    expect(textsOf(angleLine(12.3456), baseCoords())).toEqual(["12.35\u00ba"]);
    expect(textsOf(angleLine(-59.044), baseCoords())).toEqual(["-59.04\u00ba"]);
  });

  it("uk-UA uses a comma, en keeps the period", () => {
    expect(textsOf(angleLine(12.3456), baseCoords({ numberLocale: "uk-UA" }))).toEqual(["12,35\u00ba"]);
    expect(textsOf(angleLine(12.3456), baseCoords({ numberLocale: "en" }))).toEqual(["12.35\u00ba"]);
  });
});

const UK = { numberLocale: "uk-UA" };
const uk = (n: number) => new Intl.NumberFormat("uk-UA").format(n);
/** EN text -> the same text with a comma decimal (only valid for texts with no thousands group). */
const comma = (texts: string[]) => texts.map((t) => t.replace(/\./g, ","));

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

describe("numberLocale: line, channel, data and stats numbers", () => {
  const trend = () => drawing("trend-line", [pt(5, 1500), pt(20, 1000)], ALL_STATS);

  it("unset keeps the v0.8.0 trend-line stats strings", () => {
    expect(textsOf(trend(), baseCoords())).toEqual([
      "\u2212500.00 (\u221233.33%), \u221250000",
      "15 bars (15d), distance: 2504 px",
      "-86.57\u00ba",
    ]);
  });

  it("uk-UA: price range, percent, pips, distance and the stats-row angle", () => {
    expect(textsOf(trend(), baseCoords(UK))).toEqual([
      `\u2212500,00 (\u221233,33%), \u2212${uk(50000)}`,
      `15 bars (15d), distance: ${uk(2504)} px`,
      `${uk(-86.57)}\u00ba`,
    ]);
  });

  it("time span and volume text group like the locale (days, K / M / B)", () => {
    expect(tvTimeSpan(1500 * 86400 + 3600)).toBe("1,500d 1h");
    expect(tvTimeSpan(1500 * 86400 + 3600, UK)).toBe(`${uk(1500)}d 1h`);
    expect(tvVolume(1_234_567)).toBe("1.23\u202fM");
    expect(tvVolume(1_234_567, UK)).toBe("1,23\u202fM");
    expect(tvVolume(-12_345, UK)).toBe(`${uk(-12.35)}\u202fK`);
  });

  it("price-range / date-and-price-range tools follow the locale", () => {
    for (const kind of ["price-range", "date-and-price-range"] as const) {
      const d = drawing(kind, [pt(5, 100), pt(20, 101.5)]);
      const en = textsOf(d, baseCoords());
      expect(en.join("|")).toMatch(/\d\.\d/);
      expect(textsOf(d, baseCoords(UK))).toEqual(comma(en));
    }
  });

  it("disjoint-channel prices use the locale", () => {
    const d = drawing("disjoint-channel", [pt(5, 100), pt(30, 130), pt(5, 110)], { showPrices: true });
    const en = textsOf(d, baseCoords());
    expect(en.length).toBe(4);
    expect(textsOf(d, baseCoords(UK))).toEqual(comma(en));
  });

  it("regression Pearson default keeps full precision with a comma", () => {
    const d = drawing("regression-trend", [pt(5, 100), pt(40, 140)], { showPearsons: true });
    expect(textsOf(d, baseCoords())).toEqual(["0.9028568950984005"]);
    expect(textsOf(d, baseCoords(UK))).toEqual(["0,9028568950984005"]);
  });

  it("volume profile row values use the locale", () => {
    const d = drawing("fixed-range-volume-profile", [pt(5, 90), pt(40, 160)], {
      vp: { showValues: true, rows: 8 },
    } as Partial<DrawingStyle>);
    const en = textsOf(d, baseCoords());
    expect(en.length).toBeGreaterThan(0);
    expect(textsOf(d, baseCoords(UK))).toEqual(comma(en));
  });

  it("formatLabel wins over the locale default; undefined / null gives the locale default", () => {
    const hook = (ret: string | null | undefined): LabelFormatter => (l) => (l.id === "price-range" ? ret : undefined);
    const win = textsOf(trend(), baseCoords({ ...UK, formatLabel: hook("X") }));
    expect(win[0]).toBe("X");
    for (const ret of [undefined, null]) {
      expect(textsOf(trend(), baseCoords({ ...UK, formatLabel: hook(ret) }))[0]).toBe(`\u2212500,00 (\u221233,33%), \u2212${uk(50000)}`);
    }
  });

  it("an invalid locale tag paints the EN text", () => {
    expect(textsOf(trend(), baseCoords({ numberLocale: "not a locale!" }))).toEqual(textsOf(trend(), baseCoords()));
  });
});

describe("DrawingManager numberLocale option and setter", () => {
  const managers: DrawingManager[] = [];
  afterEach(() => {
    for (const m of managers.splice(0)) m.destroy();
  });

  function setup(opts: { numberLocale?: string; formatLabel?: LabelFormatter } = {}) {
    (globalThis as { window?: EventTarget }).window = new EventTarget();
    const { chart, series } = fakeChart();
    const dm = new DrawingManager(chart, series, opts);
    managers.push(dm);
    dm.add({
      kind: "trend-angle",
      points: [{ time: 1_700_000_000 as Time, price: 1 }, { time: 1_700_000_060 as Time, price: 2 }],
      style: { ...defaultStyleFor("trend-angle"), angle: 12.3456 },
    });
    let redraws = 0;
    (dm as unknown as { primitive: { requestUpdate(): void } }).primitive.requestUpdate = () => void redraws++;
    const paint = () => flat(dm.scenes(W, H).flatMap((s) => s.scene))
      .filter((it): it is Extract<SceneItem, { t: "text" }> => it.t === "text")
      .map((it) => it.text);
    const coords = () => (dm as unknown as { coords: Coords }).coords;
    return { dm, paint, coords, redraws: () => redraws };
  }

  it("the option lands on the coords and the next paint uses it", () => {
    const m = setup({ numberLocale: "uk-UA" });
    expect(m.coords().numberLocale).toBe("uk-UA");
    expect(m.paint()).toEqual(["12,35\u00ba"]);
  });

  it("setNumberLocale switches live, requests a repaint, and undefined restores EN", () => {
    const m = setup();
    expect(m.paint()).toEqual(["12.35\u00ba"]);
    const before = m.redraws();
    m.dm.setNumberLocale("uk-UA");
    expect(m.coords().numberLocale).toBe("uk-UA");
    expect(m.redraws()).toBeGreaterThan(before);
    expect(m.paint()).toEqual(["12,35\u00ba"]);
    m.dm.setNumberLocale("en");
    expect(m.paint()).toEqual(["12.35\u00ba"]);
    m.dm.setNumberLocale(undefined);
    expect(m.coords().numberLocale).toBeUndefined();
    expect(m.paint()).toEqual(["12.35\u00ba"]);
  });
});

const lv = (coeff: number, label?: string) => ({ coeff, color: "#2962ff", visible: true, ...(label ? { label } : {}) });
const DECIMAL = /\d\.\d/;

describe("numberLocale: fib, Gann and pattern numbers", () => {
  it("fib time zone gets coords from the dispatcher: a 1.5 level reads 1,5 under uk-UA", () => {
    const d = drawing("fib-time-zone", [pt(5, 100), pt(10, 110)], { levels: [lv(0), lv(1.5), lv(2)] });
    expect(textsOf(d, baseCoords())).toEqual(["0", "1.5", "2"]);
    expect(textsOf(d, baseCoords(UK))).toEqual(["0", "1,5", "2"]);
    expect(textsOf(d, baseCoords({ numberLocale: "en" }))).toEqual(["0", "1.5", "2"]);
  });

  it("fib time zone keeps every digit of a level under a locale (no extra rounding)", () => {
    const d = drawing("fib-time-zone", [pt(5, 100), pt(10, 110)], { levels: [lv(0), lv(0.23606)] });
    expect(textsOf(d, baseCoords())).toEqual(["0", "0.23606"]);
    expect(textsOf(d, baseCoords(UK))).toEqual(["0", "0,23606"]);
  });

  it("trend-based fib time: default 0.382 level", () => {
    const d = drawing("trend-based-fib-time", [pt(5, 100), pt(15, 120), pt(25, 110)]);
    const en = textsOf(d, baseCoords());
    expect(en).toContain("0.382");
    expect(textsOf(d, baseCoords(UK))).toEqual(comma(en));
  });

  it("fib retracement: coefficient and price in parentheses, percent mode, hook precedence", () => {
    const d = drawing("fib-retracement", [pt(5, 100), pt(30, 140)]);
    const en = textsOf(d, baseCoords());
    expect(en).toContain("0.618 (115.28)");
    expect(textsOf(d, baseCoords(UK))).toContain("0,618 (115,28)");
    const pct = drawing("fib-retracement", [pt(5, 100), pt(30, 140)], { fibLevelsAsPercents: true });
    expect(textsOf(pct, baseCoords())).toContain("61.80% (115.28)");
    expect(textsOf(pct, baseCoords(UK))).toContain("61,80% (115,28)");
    const hook: LabelFormatter = (l) => (l.id === "fib-level" ? "X" : undefined);
    expect(new Set(textsOf(d, baseCoords({ ...UK, formatLabel: hook })))).toEqual(new Set(["X"]));
    expect(textsOf(d, baseCoords({ ...UK, formatLabel: () => undefined }))).toContain("0,618 (115,28)");
  });

  const FAMILY: [Drawing["kind"], Drawing["points"], Partial<DrawingStyle>?][] = [
    ["trend-based-fib-extension", [pt(5, 100), pt(20, 140), pt(30, 120)]],
    ["fib-channel", [pt(5, 100), pt(30, 130), pt(5, 110)]],
    ["fib-speed-resistance-fan", [pt(5, 100), pt(30, 140)]],
    ["fib-speed-resistance-arcs", [pt(5, 100), pt(30, 140)]],
    ["fib-circles", [pt(5, 100), pt(30, 140)]],
    ["fib-wedge", [pt(5, 100), pt(30, 140), pt(30, 100)]],
    ["gann-box", [pt(5, 100), pt(30, 140)]],
    ["gann-square", [pt(5, 100), pt(30, 140)]],
    ["gann-fan", [pt(5, 100), pt(30, 140)], { levels: [lv(0.25), lv(0.5), lv(2)] }],
    ["abcd-pattern", [pt(5, 100), pt(15, 140), pt(25, 120), pt(35, 150)]],
    ["xabcd-pattern", [pt(5, 100), pt(12, 140), pt(20, 115), pt(28, 135), pt(36, 120)]],
    ["cypher-pattern", [pt(5, 100), pt(12, 140), pt(20, 115), pt(28, 135), pt(36, 120)]],
    ["three-drives-pattern", [pt(2, 100), pt(8, 130), pt(14, 112), pt(20, 140), pt(26, 123), pt(32, 150), pt(38, 130)]],
  ];

  it.each(FAMILY)("%s: a decimal reads with a comma under uk-UA, EN text unchanged when unset", (kind, points, style) => {
    const d = { ...drawing(kind, points, style), fmt: 2 } as Drawing;
    const en = textsOf(d, baseCoords());
    expect(en.some((t) => DECIMAL.test(t))).toBe(true);
    expect(textsOf(d, baseCoords({ numberLocale: "en" }))).toEqual(en);
    expect(textsOf(d, baseCoords({ numberLocale: "not a locale!" }))).toEqual(en);
    const uk = textsOf(d, baseCoords(UK));
    expect(uk.some((t) => DECIMAL.test(t))).toBe(false);
    expect(uk).toEqual(comma(en));
  });

  it("gann fan keeps the typed / default level text and only routes the coefficient fallback", () => {
    const labelled = drawing("gann-fan", [pt(5, 100), pt(30, 140)], { levels: [lv(0.25, "1/4"), lv(0.5)] });
    expect(textsOf(labelled, baseCoords(UK))).toEqual(["1/4", "0,5"]);
    expect(textsOf(labelled, baseCoords())).toEqual(["1/4", "0.5"]);
  });

  it("gann square bars and ratio follow the locale", () => {
    const d = drawing("gann-square", [pt(5, 100), pt(30, 140)]);
    const en = textsOf(d, baseCoords());
    expect(en).toContain("25");
    expect(en).toContain("1.6");
    expect(textsOf(d, baseCoords(UK))).toContain("1,6");
  });

  it("pattern ratios keep the full rounding (3 decimals; three drives 2)", () => {
    const abcd = drawing("abcd-pattern", [pt(5, 100), pt(15, 140), pt(25, 120), pt(35, 150)]);
    expect(textsOf(abcd, baseCoords()).slice(0, 2)).toEqual(["0.5", "1.5"]);
    expect(textsOf(abcd, baseCoords(UK)).slice(0, 2)).toEqual(["0,5", "1,5"]);
  });
});

describe("numberLocale: position, forecast, price note and price label numbers", () => {
  const POS = [pt(10, 120), pt(25, 120)] as Drawing["points"];
  const LEVELS = { showStats: true, stopLevel: 15, profitLevel: 30 };
  const MINUS = "\u2212";
  const long = (compactStats: boolean) => drawing("long-position", POS, { ...LEVELS, compactStats });
  const short = (compactStats: boolean) => drawing("short-position", POS, { ...LEVELS, compactStats });

  it("unset keeps the v0.8.0 position text", () => {
    expect(textsOf(long(false), baseCoords())).toEqual([
      "Target: 30.00 (25.000%) 3,000, Amount: 1500",
      "Open PnL: 0.50, Qty: 16",
      "Risk/reward ratio: 2",
      "Stop: 15.00 (12.500%) 1,500, Amount: 750",
    ]);
  });

  it("uk-UA: prices, percents, ticks, amounts and PnL use the locale (full and compact)", () => {
    expect(textsOf(long(false), baseCoords(UK))).toEqual([
      `Target: 30,00 (25,000%) ${uk(3000)}, Amount: ${uk(1500)}`,
      "Open PnL: 0,50, Qty: 16",
      "Risk/reward ratio: 2",
      `Stop: 15,00 (12,500%) ${uk(1500)}, Amount: 750`,
    ]);
    expect(textsOf(long(true), baseCoords(UK))).toEqual([
      `30,00 (25,000%) ${uk(3000)} ${uk(1500)}`,
      "0,50 ~ 16",
      "2",
      `15,00 (12,500%) ${uk(1500)} 750`,
    ]);
    expect(textsOf(short(false), baseCoords(UK))[1]).toBe(`Open PnL: ${MINUS}0,50, Qty: 16`);
  });

  it("a fractional ratio and quantity read with a comma", () => {
    const d = drawing("long-position", POS, { ...LEVELS, stopLevel: 20, profitLevel: 30, riskPercent: 3, qtyPrecision: "2" });
    const en = textsOf(d, baseCoords());
    expect(en.join("|")).toMatch(/Risk\/reward ratio: 1\.5/);
    expect(textsOf(d, baseCoords(UK)).join("|")).toMatch(/Risk\/reward ratio: 1,5/);
  });

  it("quantity keeps all qtyPrecision 10 digits under a locale", () => {
    const d = drawing("long-position", POS, { ...LEVELS, stopLevel: 30, profitLevel: 30, riskPercent: 1, qtyPrecision: "10" });
    const qty = (t: string[]) => t.join("|").match(/Qty: (\S+?)(?:, |\||$)/)?.[1];
    const en = qty(textsOf(d, baseCoords()));
    expect(en).toBe("0.3333333333");
    expect(qty(textsOf(d, baseCoords(UK)))).toBe(en!.replace(".", ","));
  });

  it("formatLabel wins on position-target; undefined gives the locale default", () => {
    const hook = (ret: string | undefined): LabelFormatter => (l) => (l.id === "position-target" ? ret : undefined);
    expect(textsOf(long(false), baseCoords({ ...UK, formatLabel: hook("T") }))[0]).toBe("T");
    expect(textsOf(long(false), baseCoords({ ...UK, formatLabel: hook(undefined) }))[0]).toBe(`Target: 30,00 (25,000%) ${uk(3000)}, Amount: ${uk(1500)}`);
  });

  it("position forecast prices, change and percent", () => {
    const d = drawing("position-forecast", [pt(10, 110), pt(30, 140)]);
    expect(textsOf(d, baseCoords())).toEqual(["110.00", "2026-01-15", "30.00 (27.27%) in 20d", "140.00", "2026-02-04", "FAILURE"]);
    expect(textsOf(d, baseCoords(UK))).toEqual(["110,00", "2026-01-15", "30,00 (27,27%) in 20d", "140,00", "2026-02-04", "FAILURE"]);
  });

  it("price note and price label default price text", () => {
    const grouped = new Intl.NumberFormat("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(1234.56);
    const note = drawing("price-note", [pt(20, 1234.56), pt(25, 1300)], { text: "" });
    const label = drawing("price-label", [pt(20, 1234.56)]);
    expect(textsOf(note, baseCoords())).toEqual(["1234.56"]);
    expect(textsOf(label, baseCoords())).toEqual(["1234.56"]);
    expect(textsOf(note, baseCoords(UK))).toEqual([grouped]);
    expect(textsOf(label, baseCoords(UK))).toEqual([grouped]);
    const hook: LabelFormatter = (l) => (l.id === "price" ? "P" : undefined);
    expect(textsOf(label, baseCoords({ ...UK, formatLabel: hook }))).toEqual(["P"]);
  });
});

describe("numberLocale: vertex ordinals beyond the label table", () => {
  it("elliott fallback index stays fixed notation, like the wave label table", () => {
    const d = drawing("elliott-impulse", [0, 3, 6, 9, 12, 15, 18, 21].map((i) => pt(i, 100 + (i % 2) * 10)));
    const en = textsOf(d, baseCoords());
    expect(en.slice(-2)).toEqual(["(6)", "(7)"]);
    expect(textsOf(d, baseCoords({ numberLocale: "ar-EG" }))).toEqual(en);
  });
});