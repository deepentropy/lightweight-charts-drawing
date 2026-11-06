/**
 * formatLabel width: the badge box is sized from the formatted string
 * (Cyrillic + NBSP), with the same padding as the default English string.
 * Stubs are installed before any measuring so the lazy measureCtx picks them up.
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

const CYR = "Ціна: 1\u00A0234,5";
const DEFAULT_PRICE = "\u2212500.00 (\u221233.33%) \u221250000";
const WIDTHS: Record<string, number> = {
  [CYR]: 142,
  [DEFAULT_PRICE]: 88,
};

const stubCanvas = {
  getContext: () => ({
    measureText: (s: string) => ({ width: WIDTHS[s] ?? s.length * 7 }),
    font: "",
  }),
};

(globalThis as { document?: unknown }).document = {
  createElement: () => stubCanvas,
  addEventListener() {},
  removeEventListener() {},
};
(globalThis as { getComputedStyle?: unknown }).getComputedStyle = () => ({ fontFamily: "sans-serif" });

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

function project(d: Drawing, c: Coords) {
  return d.points.map((p) => ({ x: c.timeToX(p.time)!, y: c.priceToY(p.price)! }));
}

function flat(s: Scene): SceneItem[] {
  return s.flatMap((it) => (it.t === "group" ? flat(it.items) : [it]));
}

function labelBoxWidth(d: Drawing, c: Coords): number {
  const rect = flat(sceneOf(d, project(d, c), { w: W, h: H, coords: c, selected: false })).find(
    (it): it is Extract<SceneItem, { t: "rect" }> => it.t === "rect" && it.rx === 4 && it.fill != null && it.fill !== "transparent",
  );
  if (!rect || !("w" in rect)) throw new Error("label box rect not found");
  return rect.w;
}

describe("formatLabel badge width follows formatted text", () => {
  it("Cyrillic + NBSP string sizes the price-range badge with the same padding", () => {
    const points = [pt(5, 1500), pt(20, 1000)] as Drawing["points"];
    const d = drawing("price-range", points);
    const defaultW = labelBoxWidth(d, coords);
    const formattedW = labelBoxWidth(d, {
      ...coords,
      formatLabel: (label) => (label.id === "price-range" ? CYR : label.text),
    });
    const padDefault = defaultW - WIDTHS[DEFAULT_PRICE];
    const padFormatted = formattedW - WIDTHS[CYR];
    expect(padFormatted).toBe(padDefault);
    expect(formattedW).not.toBe(defaultW);
  });
});
