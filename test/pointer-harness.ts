// Node harness for the pointer gestures of DrawingManager (no jsdom): fake window / document / chart /
// series, and an event builder. Events are plain `Event`s with the pointer fields assigned.
import { vi } from "vitest";
import { DrawingManager } from "../src";

type Entry = { type: string; fn: (e: Event) => void; once: boolean; capture: boolean };

/** Minimal EventTarget that counts add / remove calls and knows its live listeners (`once` included). */
export class FakeTarget {
  entries: Entry[] = [];
  adds: Record<string, number> = {};
  removes: Record<string, number> = {};
  addEventListener(type: string, fn: (e: Event) => void, o?: boolean | { once?: boolean; capture?: boolean; passive?: boolean }): void {
    const opt = typeof o === "object" ? o : { capture: !!o };
    this.entries.push({ type, fn, once: !!opt.once, capture: !!opt.capture });
    this.adds[type] = (this.adds[type] ?? 0) + 1;
  }
  removeEventListener(type: string, fn: (e: Event) => void, o?: boolean | { capture?: boolean }): void {
    const capture = typeof o === "object" ? !!o.capture : !!o;
    const i = this.entries.findIndex((x) => x.type === type && x.fn === fn && x.capture === capture);
    if (i < 0) return;
    this.entries.splice(i, 1);
    this.removes[type] = (this.removes[type] ?? 0) + 1;
  }
  dispatchEvent(e: Event): boolean {
    for (const x of this.entries.filter((y) => y.type === e.type)) {
      if (x.once) this.entries.splice(this.entries.indexOf(x), 1);
      x.fn(e);
    }
    return !e.defaultPrevented;
  }
  live(type: string): number {
    return this.entries.filter((x) => x.type === type).length;
  }
  liveTotal(): number {
    return this.entries.length;
  }
}

export function ev(type: string, props: Record<string, unknown> = {}): Event {
  const e = new Event(type, { bubbles: true, cancelable: true });
  return Object.assign(e, props);
}

/** A pointer event: pointerType and isPrimary are set explicitly, mouse ones included. */
export function ptr(type: string, pointerType: string, x: number, y: number, extra: Record<string, unknown> = {}): Event {
  return ev(type, { button: 0, pointerType, isPrimary: true, clientX: x, clientY: y, ctrlKey: false, metaKey: false, ...extra });
}

const SAVED_SCROLL = { horzTouchDrag: true, vertTouchDrag: true, mouseWheel: true, pressedMouseMove: true };
const SAVED_SCALE = { pinch: true, mouseWheel: true, axisPressedMouseMove: { time: true, price: true } };
export const SAVED = { handleScroll: SAVED_SCROLL, handleScale: SAVED_SCALE };
export const OFF = { handleScroll: false, handleScale: false };

/** x = time, y = 500 - price; a 800 x 500 pane at the origin. */
export function setup() {
  const win = new FakeTarget();
  const doc = new FakeTarget();
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", doc);
  const el = new FakeTarget() as FakeTarget & { getBoundingClientRect(): object };
  el.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 500, width: 800, height: 500 });
  const opts = {
    handleScroll: structuredClone(SAVED_SCROLL),
    handleScale: structuredClone(SAVED_SCALE),
    layout: { fontFamily: "sans-serif", fontSize: 12, background: { color: "#000" } },
    localization: {},
    timeScale: {},
  };
  const chart = {
    chartElement: () => el,
    options: () => opts,
    applyOptions: vi.fn(),
    paneSize: () => ({ width: 800, height: 500 }),
    priceScale: () => ({ width: () => 0 }),
    timeScale: () => ({ timeToCoordinate: (t: number) => t, coordinateToTime: (x: number) => x, height: () => 0, width: () => 800 }),
  };
  const series = {
    attachPrimitive() {},
    detachPrimitive() {},
    data: () => [],
    getPane: () => ({ paneIndex: () => 0, getHTMLElement: () => el }),
    priceToCoordinate: (p: number) => 500 - p,
    coordinateToPrice: (y: number) => 500 - y,
    priceScale: () => ({ options: () => ({ mode: 0 }) }),
    options: () => ({}),
  };
  const dm = new DrawingManager(chart as never, series as never);
  // Listeners of the constructor stay out of the gesture counts.
  const base = { win: win.liveTotal(), doc: doc.liveTotal(), el: el.liveTotal() };
  return { win, doc, el, chart, dm, base };
}

/** A selected trend line with its anchors at pixels (100, 200) and (300, 300). */
export function withSelectedLine(s: ReturnType<typeof setup>): string {
  const id = s.dm.add({ kind: "trend-line", points: [{ time: 100 as never, price: 300 }, { time: 300 as never, price: 200 }] });
  s.dm.select([id]);
  return id;
}
