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
