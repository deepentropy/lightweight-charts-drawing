/**
 * Characterization of every default on-canvas label string of unmodified
 * lightweight-charts-drawing@0.6.3. Assert with literal `toEqual` arrays only
 * — no snapshot matcher — so `vitest -u` can never rewrite them.
 *
 * Literals were collected once on pristine 0.6.3 (upstream/main 3a88ce1) and
 * pasted here. Special characters stay as `\u` escapes for ASCII readability.
 */
import { describe, expect, it } from "vitest";
import type { Time } from "lightweight-charts";
import {
  defaultStyleFor,
  sceneOf,
  type Coords,
  type Drawing,
  type DrawingStyle,
  type OHLC,
  type Scene,
  type SceneItem,
} from "lightweight-charts-drawing";

// Text is measured on a canvas; under Node there is none and the core falls back to an estimate.
(globalThis as { document?: unknown }).document ??= { createElement: () => ({ getContext: () => null }) };

const W = 800;
const H = 500;
const SP = 10; // px per bar
const DAY = 86400;
const T0 = Date.UTC(2026, 0, 5) / 1000;

/** 60 daily bars with volume; fixed data includes a multi-day span and large volumes. */
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

/** Linear chart: bar i at x = i * SP, price p at y = 500 - (p - 80) * 5. */
const coords: Coords = {
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
};

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

function project(d: Drawing) {
  return d.points.map((p) => ({ x: coords.timeToX(p.time)!, y: coords.priceToY(p.price)! }));
}

function flat(s: Scene): SceneItem[] {
  return s.flatMap((it) => (it.t === "group" ? flat(it.items) : [it]));
}

/** Collect every `t: "text"` string from `sceneOf` (walks nested groups). */
function textsOf(d: Drawing, selected = false): string[] {
  return flat(sceneOf(d, project(d), { w: W, h: H, coords, selected }))
    .filter((it): it is Extract<SceneItem, { t: "text" }> => it.t === "text")
    .map((it) => it.text);
}

const POS_PTS = [pt(10, 120), pt(25, 120)] as Drawing["points"];
const POS_LEVELS = { showStats: true, stopLevel: 15, profitLevel: 30 } as const;

describe("0.6.3 default on-canvas labels", () => {
  it("trend-line: every stat row on (price/percent/pips, bars/date/distance, angle)", () => {
    expect(
      textsOf(
        drawing("trend-line", [pt(5, 1500), pt(20, 1000)], {
          showStats: true,
          showPriceRange: true,
          showPercentPriceRange: true,
          showPipsPriceRange: true,
          showBarsRange: true,
          showDateTimeRange: true,
          showDistance: true,
          showAngle: true,
        }),
      ),
    ).toEqual([
      "\u2212500.00 (\u221233.33%), \u221250000",
      "15 bars (15d), distance: 2504 px",
      "-86.57\u00ba",
    ]);
  });

  it("price-range", () => {
    expect(textsOf(drawing("price-range", [pt(5, 1500), pt(20, 1000)]))).toEqual([
      "\u2212500.00 (\u221233.33%) \u221250000",
    ]);
  });

  it("date-range", () => {
    expect(textsOf(drawing("date-range", [pt(5, 1500), pt(20, 1000)]))).toEqual([
      "15 bars, 15d",
      "Vol 3.27\u202FM",
    ]);
  });

  it("date-and-price-range", () => {
    expect(textsOf(drawing("date-and-price-range", [pt(5, 1500), pt(20, 1000)]))).toEqual([
      "\u2212500.00 (\u221233.33%) \u221250000",
      "15 bars, 15d",
      "Vol 3.27\u202FM",
    ]);
  });

  it("long-position: full and compact text", () => {
    expect(textsOf(drawing("long-position", POS_PTS, { ...POS_LEVELS, compactStats: false }))).toEqual([
      "Target: 30.00 (25.000%) 3,000, Amount: 1500",
      "Open PnL: 0.50, Qty: 16",
      "Risk/reward ratio: 2",
      "Stop: 15.00 (12.500%) 1,500, Amount: 750",
    ]);
    expect(textsOf(drawing("long-position", POS_PTS, { ...POS_LEVELS, compactStats: true }))).toEqual([
      "30.00 (25.000%) 3,000 1500",
      "0.50 ~ 16",
      "2",
      "15.00 (12.500%) 1,500 750",
    ]);
  });

  it("short-position: full and compact text", () => {
    expect(textsOf(drawing("short-position", POS_PTS, { ...POS_LEVELS, compactStats: false }))).toEqual([
      "Target: 30.00 (25.000%) 3,000, Amount: 1500",
      "Open PnL: \u22120.50, Qty: 16",
      "Risk/reward ratio: 2",
      "Stop: 15.00 (12.500%) 1,500, Amount: 750",
    ]);
    expect(textsOf(drawing("short-position", POS_PTS, { ...POS_LEVELS, compactStats: true }))).toEqual([
      "30.00 (25.000%) 3,000 1500",
      "\u22120.50 ~ 16",
      "2",
      "15.00 (12.500%) 1,500 750",
    ]);
  });

  it("position-forecast (incl. date)", () => {
    expect(textsOf(drawing("position-forecast", [pt(10, 110), pt(30, 140)]))).toEqual([
      "110.00",
      "2026-01-15",
      "30.00 (27.27%) in 20d",
      "140.00",
      "2026-02-04",
      "FAILURE",
    ]);
  });

  it("fib-retracement with prices", () => {
    expect(
      textsOf(
        drawing("fib-retracement", [pt(15, 103), pt(45, 152)], {
          showPrices: true,
          showCoeffs: true,
        }),
      ),
    ).toEqual([
      "0 (152.00)",
      "0.236 (140.44)",
      "0.382 (133.28)",
      "0.5 (127.50)",
      "0.618 (121.72)",
      "0.786 (113.49)",
      "1 (103.00)",
      "1.618 (72.72)",
      "2.618 (23.72)",
      "3.618 (-25.28)",
      "4.236 (-55.56)",
    ]);
  });

  it("regression-trend with Pearson's R", () => {
    expect(
      textsOf(
        drawing("regression-trend", [pt(5, 100), pt(40, 140)], {
          showPearsons: true,
        }),
      ),
    ).toEqual(["0.9028568950984005"]);
  });

  it("fixed-range-volume-profile with values", () => {
    expect(
      textsOf(
        drawing("fixed-range-volume-profile", [pt(5, 90), pt(40, 160)], {
          vp: { showValues: true, rows: 8 },
        } as Partial<DrawingStyle>),
      ),
    ).toEqual(["1.22M", "1.82M", "1.40M", "1.27M", "1.42M", "1.58M", "1.70M", "1.40M"]);
  });

  it("price-note", () => {
    expect(textsOf(drawing("price-note", [pt(20, 1234.56), pt(25, 1300)], { text: "" }))).toEqual([
      "1234.56",
    ]);
  });

  it("price-label", () => {
    expect(textsOf(drawing("price-label", [pt(20, 1234.56)]))).toEqual(["1234.56"]);
  });

  it("disjoint-channel with prices", () => {
    expect(
      textsOf(
        drawing("disjoint-channel", [pt(5, 100), pt(30, 130), pt(5, 110)], {
          showPrices: true,
        }),
      ),
    ).toEqual(["100.00", "130.00", "110.00", "140.00"]);
  });

  it("gann-square with ratios", () => {
    expect(
      textsOf(
        drawing("gann-square", [pt(5, 100), pt(25, 140)], {
          showLabels: true,
        }),
      ),
    ).toEqual(["40.00", "20", "2"]);
  });
});
