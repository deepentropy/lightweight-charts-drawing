/**
 * formatLabel hook: every label carries `kind` + `drawingId` (context set once
 * per drawing, merged in labelOrDefault), and stats rows get a row-level label.
 * Compact self-contained harness (the larger one lives in labels-hook.test.ts).
 */
import { afterEach, describe, expect, it } from "vitest";
import type { Time } from "lightweight-charts";
import {
  DrawingManager,
  defaultStyleFor,
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

const bars: OHLC[] = Array.from({ length: 60 }, (_, i) => ({
  time: (T0 + i * DAY) as Time,
  open: 100 + i,
  high: 102 + i,
  low: 98 + i,
  close: 101 + i,
  volume: 50_000 + i * 12_345,
}));

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

const pt = (i: number, price: number) => ({ time: bars[i].time, price });

function drawing(kind: Drawing["kind"], points: Drawing["points"], style?: Partial<DrawingStyle>, id = `dw_${kind}`): Drawing {
  return { id, kind, points, style: { ...defaultStyleFor(kind), ...style } } as Drawing;
}

const project = (d: Drawing, c: Coords) => d.points.map((p) => ({ x: c.timeToX(p.time)!, y: c.priceToY(p.price)! }));

const flat = (s: Scene): SceneItem[] => s.flatMap((it) => (it.t === "group" ? flat(it.items) : [it]));

function texts(d: Drawing, c: Coords): string[] {
  return flat(sceneOf(d, project(d, c), { w: W, h: H, coords: c, selected: false }))
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
const TREND = drawing("trend-line", [pt(5, 150), pt(20, 100)], ALL_STATS);

describe("label context: kind + drawingId on every label", () => {
  it("a trend line's labels all carry its kind and id", () => {
    const seen: DrawingLabel[] = [];
    texts(TREND, baseCoords({ formatLabel: (l) => (seen.push(l), undefined) }));
    expect(seen.length).toBeGreaterThanOrEqual(5);
    for (const l of seen) expect(l).toMatchObject({ kind: "trend-line", drawingId: "dw_trend-line" });
  });

  it("two drawings in one paint do not leak context; it is cleared afterwards", () => {
    const seen: DrawingLabel[] = [];
    const c = baseCoords({ formatLabel: (l) => (seen.push(l), undefined) });
    const range = drawing("price-range", [pt(5, 150), pt(20, 100)], undefined, "dw_range");
    texts(TREND, c);
    texts(range, c);
    texts(TREND, c);
    const ids = new Set(seen.map((l) => `${l.kind}:${l.drawingId}`));
    expect([...ids].sort()).toEqual(["price-range:dw_range", "trend-line:dw_trend-line"]);
    expect(seen.filter((l) => l.kind === "price-range").every((l) => l.drawingId === "dw_range")).toBe(true);
    expect(c.labelContext).toBeUndefined();
  });

  it("hit-test labels (price label box) carry the context too", () => {
    const seen: DrawingLabel[] = [];
    const c = baseCoords({ formatLabel: (l) => (seen.push(l), undefined) });
    const d = drawing("price-label", [pt(20, 123.45)]);
    hitTestKind(d, project(d, c), { x: 0, y: 0 }, W, H, c);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((l) => l.kind === "price-label" && l.drawingId === "dw_price-label")).toBe(true);
  });

  describe("DrawingManager", () => {
    const managers: DrawingManager[] = [];
    afterEach(() => {
      for (const m of managers.splice(0)) m.destroy();
    });

    /** A manager whose coords are the harness coords (the scene path only reads them). */
    function manager(seen: DrawingLabel[]) {
      const target = new EventTarget();
      (globalThis as { window?: EventTarget }).window = target;
      const el = new EventTarget() as EventTarget & { getBoundingClientRect: () => object };
      el.getBoundingClientRect = () => ({ left: 0, top: 0, right: W, bottom: H, width: W, height: H });
      const chart = {
        chartElement: () => el,
        options: () => ({ handleScroll: {}, handleScale: {}, layout: { fontFamily: "sans-serif" }, localization: {} }),
        applyOptions: () => {},
      };
      const series = { attachPrimitive() {}, detachPrimitive() {}, getPane: () => ({ paneIndex: () => 0, getHTMLElement: () => el }) };
      const formatLabel: LabelFormatter = (l) => (seen.push(l), undefined);
      const dm = new DrawingManager(chart as never, series as never, { formatLabel });
      managers.push(dm);
      (dm as unknown as { coords: Coords }).coords = baseCoords({ formatLabel });
      return dm;
    }

    it("placed drawings carry their own id; the placement preview carries __preview__", () => {
      const seen: DrawingLabel[] = [];
      const dm = manager(seen);
      const id = dm.add({ kind: "price-range", points: [pt(5, 150), pt(20, 100)] });
      dm.scenes(W, H);
      expect(seen.length).toBeGreaterThan(0);
      expect(seen.every((l) => l.kind === "price-range" && l.drawingId === id)).toBe(true);

      seen.length = 0;
      dm.setTool("price-range");
      Object.assign(dm as unknown as { pending: unknown; cursor: unknown }, { pending: [pt(5, 150)], cursor: { x: 200, y: 300 } });
      dm.scenes(W, H);
      const preview = seen.filter((l) => l.drawingId === "__preview__");
      expect(preview.length).toBeGreaterThan(0);
      expect(preview.every((l) => l.kind === "price-range")).toBe(true);
    });
  });
});
