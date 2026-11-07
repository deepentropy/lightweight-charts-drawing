// Drawing points on whole bars: a time between two bars is drawn on the bar that holds it (issue #74 of the
// OpenTrader app, rules measured on the reference app).
import { describe, expect, it } from "vitest";
import type { IChartApi, ISeriesApi, SeriesType, Time } from "lightweight-charts";
import { makeCoords, type FutureAxis } from "../src/runtime/coords";
import { translateDrawing } from "../src/core/interact/project";
import { applyDrag, type DragState } from "../src/core/interact/drag";
import type { OHLC } from "../src/core/coords";
import type { Drawing } from "../src/core/types";

const SP = 10; // px per bar: bar i at x = i * SP
const M5 = 300;
/** 5 minute bars of two RTH sessions (09:30-16:00 New York, EDT = UTC-4) on 13/10/2026 and 14/10/2026. */
function sessionBars(step: number): OHLC[] {
  const out: OHLC[] = [];
  for (const day of [Date.UTC(2026, 9, 13), Date.UTC(2026, 9, 14)]) {
    const open = day / 1000 + 13.5 * 3600;
    for (let t = open; t < open + 6.5 * 3600; t += step) out.push({ time: t as Time, open: 1, high: 2, low: 0.5, close: 1.5 });
  }
  return out;
}

function mockChart(raw: OHLC[]) {
  const L = raw.length - 1;
  const chart = {
    timeScale: () => ({
      timeToCoordinate: (t: Time) => {
        const i = raw.findIndex((b) => b.time === t);
        return i < 0 ? null : i * SP;
      },
      coordinateToTime: (x: number) => {
        const i = Math.round(x / SP);
        return i >= 0 && i <= L ? raw[i].time : null;
      },
      coordinateToLogical: (x: number) => x / SP,
      logicalToCoordinate: (l: number) => (Number.isInteger(l) ? l * SP : 0),
    }),
  } as unknown as IChartApi;
  const series = {
    priceToCoordinate: (p: number) => 500 - p * 10,
    coordinateToPrice: (y: number) => (500 - y) / 10,
  } as unknown as ISeriesApi<SeriesType>;
  return makeCoords(chart, series, () => raw);
}

describe("in-range times on whole bars", () => {
  const raw = sessionBars(M5);
  const c = mockChart(raw);
  const t = (i: number) => raw[i].time as number;

  it("draws a bar time on its bar", () => {
    expect(c.timeToX(t(40) as Time)).toBe(40 * SP);
    expect(c.timeToBarIndex(t(40) as Time)).toBe(40);
  });

  it("draws a time 40 % and 60 % into a bar on that bar", () => {
    for (const f of [0.4, 0.6]) {
      const sec = t(40) + Math.round(f * M5);
      expect(c.timeToX(sec as Time)).toBe(40 * SP);
      expect(c.timeToBarIndex(sec as Time)).toBe(40);
    }
  });

  it("draws a 5 minute time on the 1 hour bar that holds it", () => {
    const h = sessionBars(3600); // 09:30, 10:30, ... 15:30
    const ch = mockChart(h);
    const at1045 = (h[1].time as number) + 15 * 60; // 10:45 -> the 10:30 bar
    const at1450 = (h[5].time as number) + 20 * 60; // 14:50 -> the 14:30 bar
    expect(ch.timeToBarIndex(at1045 as Time)).toBe(1);
    expect(ch.timeToX(at1045 as Time)).toBe(1 * SP);
    expect(ch.timeToBarIndex(at1450 as Time)).toBe(5);
    // a time in the night gap: the last bar of the session before it
    const night = (h[6].time as number) + 5 * 3600;
    expect(ch.timeToBarIndex(night as Time)).toBe(6);
  });

  it("keeps the last bar and the future rules", () => {
    const L = raw.length - 1;
    expect(c.timeToX(t(L) as Time)).toBe(L * SP);
  });
});

describe("body moves", () => {
  const h = sessionBars(3600);
  const c = mockChart(h);
  const at1045 = (h[1].time as number) + 15 * 60;
  const d = {
    id: "t",
    kind: "trend-line",
    points: [
      { time: at1045 as Time, price: 10 },
      { time: h[4].time, price: 12 },
    ],
    style: { color: "#000", width: 1, lineStyle: "solid" },
  } as unknown as Drawing;
  const screen = d.points.map((p) => ({ x: c.timeToX(p.time) as number, y: c.priceToY(p.price) as number }));

  it("a move on the same bars keeps the stored times (prices only)", () => {
    const m = translateDrawing(c, d, screen, 2, -20) as Drawing;
    expect(m.points.map((p) => p.time)).toEqual([at1045, h[4].time]);
    expect(m.points.map((p) => p.price)).toEqual([12, 14]);
  });

  it("a move to other bars puts every point on its new bar's open time", () => {
    const m = translateDrawing(c, d, screen, 2 * SP, 0) as Drawing;
    expect(m.points.map((p) => p.time)).toEqual([h[3].time, h[6].time]);
  });

  const drag = (handleIndex: number, dx: number, dy: number, hit: "handle" | "body" = "handle") => {
    const state: DragState = {
      id: "t",
      start: d,
      startCursor: screen[handleIndex],
      startScreen: screen,
      mode: hit === "handle" ? { hit, handleIndex } : { hit },
      active: true,
    };
    const cur = { x: screen[handleIndex].x + dx, y: screen[handleIndex].y + dy };
    return applyDrag(state, cur, c, (p) => p) as Drawing;
  };

  it("an anchor dragged on its bar keeps its time (price only)", () => {
    const m = drag(0, 3, -30);
    expect(m.points.map((p) => p.time)).toEqual([at1045, h[4].time]);
    expect(m.points[0].price).toBe(13);
  });

  it("an anchor dragged to another bar takes that bar's open time, the other point keeps its own", () => {
    const d2 = { ...d, points: [d.points[0], { time: (h[4].time as number) + 20 * 60, price: 12 }] } as unknown as Drawing;
    const s2 = d2.points.map((p) => ({ x: c.timeToX(p.time) as number, y: c.priceToY(p.price) as number }));
    const state: DragState = { id: "t", start: d2, startCursor: s2[0], startScreen: s2, mode: { hit: "handle", handleIndex: 0 }, active: true };
    const m = applyDrag(state, { x: s2[0].x + SP, y: s2[0].y }, c, (p) => p) as Drawing;
    expect(m.points.map((p) => p.time)).toEqual([h[2].time, (h[4].time as number) + 20 * 60]);
  });

  it("a body drag keeps the times on the same bars and moves them to other bars", () => {
    expect(drag(0, 1, 10, "body").points.map((p) => p.time)).toEqual([at1045, h[4].time]);
    expect(drag(0, SP, 0, "body").points.map((p) => p.time)).toEqual([h[2].time, h[5].time]);
  });
});

describe("before the first loaded bar with the host's calendar", () => {
  // 1 hour bars from bar 0; the host's calendar continues the same hours back (one bar per hour).
  const h = sessionBars(3600);
  const first = h[0].time as number;
  const axis: FutureAxis = {
    slots: () => 0,
    time: () => null,
    pastSlots: (time, firstTime) => Math.floor((firstTime - time) / 3600) + ((firstTime - time) % 3600 === 0 ? 0 : 1),
    pastTime: (k, firstTime) => firstTime - k * 3600,
  };
  const chart = {
    timeScale: () => ({
      timeToCoordinate: (t: Time) => {
        const i = h.findIndex((b) => b.time === t);
        return i < 0 ? null : i * SP;
      },
      coordinateToTime: (x: number) => {
        const i = Math.round(x / SP);
        return i >= 0 && i < h.length ? h[i].time : null;
      },
      coordinateToLogical: (x: number) => x / SP,
      logicalToCoordinate: (l: number) => (Number.isInteger(l) ? l * SP : 0),
    }),
  } as unknown as IChartApi;
  const c = makeCoords(chart, {} as ISeriesApi<SeriesType>, () => h, undefined, undefined, () => axis);

  it("counts whole bars both ways", () => {
    expect(c.timeToBarIndex((first - 3600 * 5) as Time)).toBe(-5);
    expect(c.timeToBarIndex((first - 3600 * 5 + 600) as Time)).toBe(-5);
    expect(c.timeToX((first - 3600 * 5 + 600) as Time)).toBe(-5 * SP);
    expect(c.barIndexToTime(-5)).toBe(first - 3600 * 5);
    expect(c.xToTime(-5.3 * SP)).toBe(first - 3600 * 5);
  });

  it("a time key puts a time on the bar whose key holds it", () => {
    // key: the first bar's time stands for its open + 30 min, so a time 10 min after the open is before it
    const keyed = makeCoords(chart, {} as ISeriesApi<SeriesType>, () => h, undefined, undefined, () => ({
      ...axis,
      timeKey: (t: number) => (t === (h[3].time as number) ? t + 1800 : t),
    }));
    expect(keyed.timeToBarIndex(((h[3].time as number) + 600) as Time)).toBe(2);
    expect(keyed.timeToBarIndex(((h[3].time as number) + 1800) as Time)).toBe(3);
  });
});

describe("the open last bar and the future without a host calendar", () => {
  const D = 86400;
  const T0 = Date.UTC(2026, 10, 1) / 1000;
  const days: OHLC[] = Array.from({ length: 6 }, (_, i) => ({ time: (T0 + i * D) as Time, open: 1, high: 2, low: 0.5, close: 1.5 }));
  const c = mockChart(days);
  const L = days.length - 1;
  const last = T0 + L * D;

  it("draws a time inside the last (still open) bar on that bar", () => {
    for (const h of [0.5, 10 + 7 / 60, 12.5, 23.9]) {
      const sec = Math.round(last + h * 3600);
      expect(c.timeToBarIndex(sec as Time)).toBe(L);
      expect(c.timeToX(sec as Time)).toBe(L * SP);
    }
  });

  it("draws a future time on the whole future bar that holds it", () => {
    expect(c.timeToBarIndex((last + D) as Time)).toBe(L + 1);
    expect(c.timeToX((last + D) as Time)).toBe((L + 1) * SP);
    expect(c.timeToBarIndex((last + 2 * D + 5 * 3600) as Time)).toBe(L + 2);
    expect(c.timeToX((last + 2 * D + 5 * 3600) as Time)).toBe((L + 2) * SP);
  });

  it("an x in the future gives the open time of its nearest future bar", () => {
    expect(c.xToTime((L + 0.6) * SP)).toBe(last + D);
    expect(c.xToTime((L + 2.4) * SP)).toBe(last + 2 * D);
    // and it comes back to the same bar
    const t = c.xToTime((L + 3.3) * SP) as Time;
    expect(c.timeToX(t)).toBe((L + 3) * SP);
  });
});
