/**
 * Keyboard opt-out: with `keyboard: false` the manager registers no window
 * keydown / keyup listener, so Delete / Backspace / Escape leave drawings
 * and the selection alone (SPEC R2 (a)). Default / `keyboard: true` keep
 * 0.6.3 behaviour (b). Destroying managers drops their listeners (c).
 * Shift / Ctrl are read from pointer events, so gestures keep their modifiers
 * with the keyboard off; cancelPending() drops a half-placed drawing.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { IChartApi, ISeriesApi, SeriesType, Time } from "lightweight-charts";
import { DrawingManager, type DrawingManagerOptions } from "../src";
import { ev, ptr, setup, withSelectedLine } from "./pointer-harness";

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

const POINT = { time: 1_700_000_000 as Time, price: 1.5 };

function assertDefaultKeys(win: EventTarget, dm: DrawingManager): void {
  const id1 = dm.add({ kind: "horizontal-line", points: [POINT] });
  dm.select([id1]);
  win.dispatchEvent(key("keydown", "Delete"));
  expect(dm.drawings()).toHaveLength(0);
  expect(dm.selection()).toEqual([]);

  const id2 = dm.add({ kind: "horizontal-line", points: [POINT] });
  dm.select([id2]);
  win.dispatchEvent(key("keydown", "Backspace"));
  expect(dm.drawings()).toHaveLength(0);
  expect(dm.selection()).toEqual([]);

  const id3 = dm.add({ kind: "horizontal-line", points: [POINT] });
  dm.select([id3]);
  win.dispatchEvent(key("keydown", "Escape"));
  expect(dm.drawings()).toHaveLength(1);
  expect(dm.selection()).toEqual([]);

  dm.select([]);
  dm.setTool("trend-line");
  expect(dm.tool()).toBe("trend-line");
  win.dispatchEvent(key("keydown", "Escape"));
  expect(dm.tool()).toBeNull();
}

describe("keyboard option", () => {
  const managers: DrawingManager[] = [];

  afterEach(() => {
    for (const m of managers.splice(0)) m.destroy();
  });

  it("(a) keyboard: false registers no key listeners and keys leave drawings/selection alone", () => {
    const { win, live } = installWindow();
    const before = { ...live };
    const { chart, series } = fakeChart();
    const dm = new DrawingManager(chart, series, { keyboard: false });
    managers.push(dm);

    expect(live.keydown - before.keydown).toBe(0);
    expect(live.keyup - before.keyup).toBe(0);

    const id = dm.add({ kind: "horizontal-line", points: [POINT] });
    dm.select([id]);
    expect(dm.drawings()).toHaveLength(1);
    expect(dm.selection()).toEqual([id]);

    win.dispatchEvent(key("keydown", "Delete"));
    win.dispatchEvent(key("keydown", "Backspace"));
    win.dispatchEvent(key("keydown", "Escape"));

    expect(dm.drawings()).toHaveLength(1);
    expect(dm.selection()).toEqual([id]);
  });

  it.each([
    { label: "default options", opts: undefined },
    { label: "keyboard: true", opts: { keyboard: true } satisfies DrawingManagerOptions },
  ])("(b) $label: Delete/Backspace remove, Escape clears selection then tool", ({ opts }) => {
    const { win } = installWindow();
    const { chart, series } = fakeChart();
    const dm = new DrawingManager(chart, series, opts);
    managers.push(dm);
    assertDefaultKeys(win, dm);
  });

  // SPEC Amendment 2 / regression guard: destroy() already removed listeners in 0.6.3.
  it("(c) two destroyed managers leave no live keydown/keyup listeners", () => {
    const { live } = installWindow();
    const a = fakeChart();
    const b = fakeChart();
    const dm1 = new DrawingManager(a.chart, a.series);
    const dm2 = new DrawingManager(b.chart, b.series);
    expect(live.keydown).toBe(2);
    expect(live.keyup).toBe(2);
    dm1.destroy();
    dm2.destroy();
    expect(live.keydown).toBe(0);
    expect(live.keyup).toBe(0);
  });
});

// ── modifiers from pointer events (D-11), default behaviour pin, cancelPending (D-12) ──

type S = ReturnType<typeof setup>;
const keyEv = (type: "keydown" | "keyup", k: string) => ev(type, { key: k });
const preview = (s: S): string => JSON.stringify((s.dm as unknown as { previewScene(w: number, h: number): unknown }).previewScene(800, 500));
const place = (s: S, x: number, y: number, mods: Record<string, unknown> = {}) => {
  s.el.dispatchEvent(ptr("pointerdown", "mouse", x, y, mods));
  s.win.dispatchEvent(ptr("pointerup", "mouse", x, y, mods));
};
const hover = (s: S, x: number, y: number, mods: Record<string, unknown> = {}) => s.el.dispatchEvent(ptr("pointermove", "mouse", x, y, mods));

/** Drags the second handle of the selected line to (400, 220); `mods` ride on the pointer events. Returns its price. */
function dragHandle(s: S, mods: Record<string, unknown> = {}): number {
  const id = withSelectedLine(s);
  s.el.dispatchEvent(ptr("pointerdown", "mouse", 300, 300, mods));
  s.doc.dispatchEvent(ptr("pointermove", "mouse", 400, 220, mods));
  s.doc.dispatchEvent(ptr("pointerup", "mouse", 400, 220, mods));
  return (s.dm.get(id)!.points as { price: number }[])[1].price;
}

/** One horizontal line placed at (100, 230); the magnet candidates of the bar at x = 100 are 100 / 400 / 50 / 200. */
function placedPrice(s: S, mods: Record<string, unknown> = {}): number {
  s.dm.setTool("horizontal-line");
  place(s, 100, 230, mods);
  return s.dm.drawings()[0].points[0].price;
}
const BAR = [{ time: 100, open: 100, high: 400, low: 50, close: 200 }] as never;

describe("modifiers come from pointer events", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("Shift still constrains a drag with keyboard: false", () => {
    const free = dragHandle(setup({ keyboard: false }));
    const shifted = dragHandle(setup({ keyboard: false }), { shiftKey: true });
    expect(free).toBe(280);
    expect(shifted).toBe(300); // 45-degree rule: horizontal from the other end keeps its price
  });

  it.each([{ ctrlKey: true }, { metaKey: true }])("keyboard: false, %o inverts the magnet (off -> strong)", (mods) => {
    const opts = { keyboard: false, bars: () => BAR } as const;
    expect(placedPrice(setup(opts))).toBe(270);
    expect(placedPrice(setup(opts), mods)).toBe(200);
  });

  it("the placement preview follows the modifiers of the latest pointermove", () => {
    const s = setup({ keyboard: false });
    s.dm.setTool("trend-line");
    place(s, 100, 200);
    hover(s, 400, 220, { shiftKey: true });
    const snapped = preview(s);
    hover(s, 400, 220);
    const free = preview(s);
    expect(free).not.toBe(snapped);
    hover(s, 400, 220, { shiftKey: true });
    expect(preview(s)).toBe(snapped);
  });

  it("keyboard: false registers no key listener and keys stay inert while modifiers work", () => {
    const s = setup({ keyboard: false });
    expect(s.win.live("keydown") + s.win.live("keyup")).toBe(0);
    const id = withSelectedLine(s);
    s.win.dispatchEvent(keyEv("keydown", "Delete"));
    s.win.dispatchEvent(keyEv("keydown", "Escape"));
    expect(s.dm.drawings()).toHaveLength(1);
    expect(s.dm.selection()).toEqual([id]);
  });
});
