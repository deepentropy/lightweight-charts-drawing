/**
 * Keyboard opt-out: with `keyboard: false` the manager registers no window
 * keydown / keyup listener, so Delete / Backspace / Escape leave drawings
 * and the selection alone (SPEC R2 (a)).
 */
import { afterEach, describe, expect, it } from "vitest";
import type { IChartApi, ISeriesApi, SeriesType, Time } from "lightweight-charts";
import { DrawingManager } from "../src";

type Counts = { keydown: number; keyup: number };

function installWindow(): { win: EventTarget; live: Counts } {
  const target = new EventTarget();
  const live: Counts = { keydown: 0, keyup: 0 };
  const add = target.addEventListener.bind(target);
  const remove = target.removeEventListener.bind(target);
  target.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
    if (type === "keydown" || type === "keyup") live[type] += 1;
    return add(type, listener, options);
  }) as typeof target.addEventListener;
  target.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => {
    if (type === "keydown" || type === "keyup") live[type] -= 1;
    return remove(type, listener, options);
  }) as typeof target.removeEventListener;
  (globalThis as { window?: EventTarget }).window = target;
  return { win: target, live };
}

(globalThis as { document?: unknown }).document ??= {
  createElement: () => ({ getContext: () => null }),
  addEventListener() {},
  removeEventListener() {},
};

function key(type: "keydown" | "keyup", keyName: string): Event {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, { key: keyName });
  return e;
}

function fakeChart() {
  const el = new EventTarget() as EventTarget & { getBoundingClientRect: () => DOMRect };
  el.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 500, width: 800, height: 500, x: 0, y: 0, toJSON() { return {}; } });
  const bars = [
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
        const i = bars.findIndex((b) => b.time === t);
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
    data: () => bars,
    getPane: () => ({ paneIndex: () => 0, getHTMLElement: () => el }),
    priceToCoordinate: (p: number) => 500 - p * 10,
    coordinateToPrice: (y: number) => (500 - y) / 10,
    priceScale: () => ({ options: () => ({ mode: 0 }), width: () => 0 }),
    options: () => ({}),
  } as unknown as ISeriesApi<SeriesType>;
  return { chart, series, el };
}

describe("keyboard: false", () => {
  const managers: DrawingManager[] = [];

  afterEach(() => {
    for (const m of managers.splice(0)) m.destroy();
  });

  it("(a) registers no key listeners and keys leave drawings/selection alone", () => {
    const { win, live } = installWindow();
    const before = { ...live };
    const { chart, series } = fakeChart();
    const dm = new DrawingManager(chart, series, { keyboard: false });
    managers.push(dm);

    expect(live.keydown - before.keydown).toBe(0);
    expect(live.keyup - before.keyup).toBe(0);

    const id = dm.add({
      kind: "horizontal-line",
      points: [{ time: 1_700_000_000 as Time, price: 1.5 }],
    });
    dm.select([id]);
    expect(dm.drawings()).toHaveLength(1);
    expect(dm.selection()).toEqual([id]);

    win.dispatchEvent(key("keydown", "Delete"));
    win.dispatchEvent(key("keydown", "Backspace"));
    win.dispatchEvent(key("keydown", "Escape"));

    expect(dm.drawings()).toHaveLength(1);
    expect(dm.selection()).toEqual([id]);
  });
});
