/**
 * setFormatLabel(fn): swaps the label hook on a live manager, one redraw per
 * call; undefined restores the library defaults. Node harness, no jsdom.
 */
import { afterEach, describe, expect, it } from "vitest";
import type { IChartApi, ISeriesApi, SeriesType, Time } from "lightweight-charts";
import { DrawingManager, type LabelFormatter } from "lightweight-charts-drawing";

const T0 = 1_700_000_000;

function fakeChart() {
  const el = new EventTarget() as EventTarget & { getBoundingClientRect: () => object };
  el.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 500, width: 800, height: 500 });
  const bars = [
    { time: T0 as Time, open: 1, high: 2, low: 0.5, close: 1.5 },
    { time: (T0 + 60) as Time, open: 1.5, high: 2.5, low: 1, close: 2 },
  ];
  const chart = {
    chartElement: () => el,
    options: () => ({ handleScroll: {}, handleScale: {}, layout: { fontFamily: "sans-serif" }, localization: {} }),
    applyOptions: () => {},
    timeScale: () => ({
      timeToCoordinate: (t: Time) => {
        const i = bars.findIndex((b) => b.time === t);
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
    data: () => bars,
    getPane: () => ({ paneIndex: () => 0, getHTMLElement: () => el }),
    priceToCoordinate: (p: number) => 500 - p * 100,
    coordinateToPrice: (y: number) => (500 - y) / 100,
    priceScale: () => ({ options: () => ({ mode: 0 }), width: () => 0 }),
    options: () => ({}),
  } as unknown as ISeriesApi<SeriesType>;
  return { chart, series };
}

describe("DrawingManager.setFormatLabel", () => {
  const managers: DrawingManager[] = [];
  afterEach(() => {
    for (const m of managers.splice(0)) m.destroy();
  });

  function setup(formatLabel?: LabelFormatter) {
    (globalThis as { window?: EventTarget }).window = new EventTarget();
    (globalThis as { document?: unknown }).document ??= {
      createElement: () => ({ getContext: () => null }),
      addEventListener() {},
      removeEventListener() {},
    };
    const { chart, series } = fakeChart();
    const dm = new DrawingManager(chart, series, formatLabel ? { formatLabel } : {});
    managers.push(dm);
    dm.add({ kind: "price-range", points: [{ time: T0 as Time, price: 1.5 }, { time: (T0 + 60) as Time, price: 4 }] });
    let redraws = 0;
    (dm as unknown as { primitive: { requestUpdate(): void } }).primitive.requestUpdate = () => void redraws++;
    const paint = () =>
      dm
        .scenes(800, 500)
        .flatMap((s) => s.scene.flatMap(function f(it): unknown[] { return it.t === "group" ? it.items.flatMap(f) : [it]; }))
        .filter((it): it is { t: "text"; text: string } => (it as { t: string }).t === "text")
        .map((it) => it.text);
    return { dm, paint, redraws: () => redraws };
  }

  it("the next paint uses the new hook; undefined restores the defaults", () => {
    const a = setup((l) => `A:${l.id}`);
    const defaults = setup().paint();
    expect(defaults.length).toBeGreaterThan(0);
    expect(a.paint().every((t) => t.startsWith("A:"))).toBe(true);

    a.dm.setFormatLabel((l) => `B:${l.id}`);
    expect(a.paint().every((t) => t.startsWith("B:"))).toBe(true);

    a.dm.setFormatLabel(undefined);
    expect(a.paint()).toEqual(defaults);
  });

  it("works on a manager built without a hook", () => {
    const m = setup();
    const defaults = m.paint();
    m.dm.setFormatLabel(() => "Z");
    expect(m.paint().every((t) => t === "Z")).toBe(true);
    m.dm.setFormatLabel(undefined);
    expect(m.paint()).toEqual(defaults);
  });

  it("requests exactly one redraw per call", () => {
    const m = setup();
    m.dm.setFormatLabel(() => "Z");
    expect(m.redraws()).toBe(1);
    m.dm.setFormatLabel(undefined);
    expect(m.redraws()).toBe(2);
  });
});
