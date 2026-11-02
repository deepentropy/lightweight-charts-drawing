// The agent skill (skills/lightweight-charts-drawing): its examples build valid drawings that survive a
// save / load round trip and draw, and its generated tool reference matches the specs.
import { describe, expect, it } from "vitest";
import type { Time } from "lightweight-charts";
import {
  OVERLAY_SPECS,
  buildNewDrawing,
  defaultStyleFor,
  hitTestKind,
  parseDrawings,
  sceneOf,
  type Coords,
  type DataPoint,
  type Drawing,
  type DrawingKind,
  type DrawingManager,
  type NewDrawing,
  type OHLC,
  type Scene,
  type SceneItem,
} from "lightweight-charts-drawing";
import { supportLine } from "../skills/lightweight-charts-drawing/examples/trend-line";
import { SHOWN_LEVELS, fibLevelPrice, swingRetracement } from "../skills/lightweight-charts-drawing/examples/fib-retracement";
import { barNote, editTextOnPlacement } from "../skills/lightweight-charts-drawing/examples/text-note";

// Text is measured on a canvas; under Node there is none and the core falls back to an estimate.
(globalThis as { document?: unknown }).document ??= { createElement: () => ({ getContext: () => null }) };

const W = 800;
const H = 500;
const SP = 10; // px per bar
const DAY = 86400;
const T0 = Date.UTC(2026, 0, 5) / 1000;

/** 60 daily bars: down to bar 15, up to bar 45, down after. */
const bars: OHLC[] = Array.from({ length: 60 }, (_, i) => {
  const mid = i <= 15 ? 120 - i : i <= 45 ? 105 + (i - 15) * 1.5 : 150 - (i - 45);
  return { time: (T0 + i * DAY) as Time, open: mid - 0.5, high: mid + 2, low: mid - 2, close: mid + 0.5 };
});

/** Linear chart: bar i at x = i * SP, price p at y = 500 - (p - 80) * 5. */
const coords: Coords = {
  priceToY: (p) => H - (p - 80) * 5,
  yToPrice: (y) => 80 + (H - y) / 5,
  isLog: () => false,
  timeToX: (t) => ((t as number) - T0) / DAY * SP,
  xToTime: (x) => (T0 + Math.round(x / SP) * DAY) as Time,
  barAt: (t) => bars.find((b) => b.time === t) ?? null,
  timeToBarIndex: (t) => Math.round(((t as number) - T0) / DAY),
  barIndexToTime: (i) => (T0 + i * DAY) as Time,
  bars: () => bars,
  visibleTimeRange: () => ({ from: T0, to: T0 + 59 * DAY }),
  indicatorValuesAt: () => [],
  pipSize: () => 0.01,
  addPriceLine: () => { throw new Error("not used"); },
  removePriceLine: () => {},
  zoomToScreenRect: () => {},
  formatTime: (t) => new Date((t as number) * 1000).toISOString().slice(0, 10),
  timeAxis: () => ({ height: 28, width: W, fontSize: 12, fontFamily: "sans-serif" }),
  timeInfo: () => ({ timeZone: "UTC", intraday: false }),
};

/** What the manager does in `add` (id + default style unless one is given). */
function asDrawing(nd: NewDrawing, id: string): Drawing {
  return { id, style: defaultStyleFor(nd.kind), ...nd } as Drawing;
}

/** Points a placement with the tool's number of clicks stores (some tools derive extra points). */
function storedPointCount(kind: DrawingKind): number {
  const n = OVERLAY_SPECS[kind].pointCount;
  const clicks = Array.from({ length: n }, (_, i): DataPoint => ({ time: (T0 + i * DAY) as Time, price: 100 + i }));
  return buildNewDrawing(kind, clicks)?.points.length ?? 0;
}

function project(d: Drawing) {
  return d.points.map((p) => ({ x: coords.timeToX(p.time)!, y: coords.priceToY(p.price)! }));
}

function sceneFor(d: Drawing, selected = false): Scene {
  return sceneOf(d, project(d), { w: W, h: H, coords, selected });
}

function flat(s: Scene): SceneItem[] {
  return s.flatMap((it) => (it.t === "group" ? flat(it.items) : [it]));
}

/** Common checks: anchor count of the tool, a lossless save / load, a non-empty scene, the anchors when selected. */
function validate(nd: NewDrawing): Drawing {
  expect(OVERLAY_SPECS[nd.kind]).toBeDefined();
  expect(nd.points.length).toBe(storedPointCount(nd.kind));
  for (const p of nd.points) {
    expect(Number.isFinite(p.price)).toBe(true);
    expect(coords.timeToBarIndex(p.time)).toBeGreaterThanOrEqual(0);
  }
  const d = asDrawing(nd, "dw_test");
  const [loaded] = parseDrawings(JSON.parse(JSON.stringify([d])));
  expect(loaded).toEqual(d);
  expect(flat(sceneFor(d)).length).toBeGreaterThan(0);
  const anchors = flat(sceneFor(d, true)).find((it) => it.t === "anchors");
  expect(anchors && anchors.t === "anchors" ? anchors.pts.length : 0).toBe(d.points.length);
  return d;
}

describe("skill examples", () => {
  it("trend line: 2 points on the lows, extended right, labelled", () => {
    const nd = supportLine(bars, 15, 30);
    const d = validate(nd);
    expect(d.kind).toBe("trend-line");
    expect(d.points.map((p) => p.price)).toEqual([bars[15].low, bars[30].low]);
    expect(d.style.extendRight).toBe(true);
    expect(d.style.width).toBe(2); // the tool default is kept
    const items = flat(sceneFor(d));
    expect(items.some((it) => it.t === "text" && it.text === "Support")).toBe(true);
    // A click on the line between its points hits its body.
    const [a, b] = project(d);
    expect(hitTestKind(d, [a, b], { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, W, H, coords)).toEqual({ hit: "body" });
  });

  it("fib retracement: low then high, the chosen levels at the right prices", () => {
    const nd = swingRetracement(bars, 5, 55);
    const d = validate(nd);
    expect(d.points.map((p) => p.price)).toEqual([bars[15].low, bars[45].high]);
    const visible = (d.style.levels ?? []).filter((l) => l.visible).map((l) => l.coeff);
    expect(visible.sort()).toEqual([...SHOWN_LEVELS].sort());
    // 0.618 of an up move from 103 to 152: 152 - 0.618 * 49.
    expect(fibLevelPrice(d.points, 0.618)).toBeCloseTo(152 - 0.618 * 49, 6);
    expect(fibLevelPrice(d.points, 0)).toBe(152);
    expect(fibLevelPrice(d.points, 1)).toBe(103);
    // One level line per visible level, each at the price of its level.
    const lines = flat(sceneFor(d)).filter((it): it is Extract<SceneItem, { t: "line" }> => it.t === "line" && it.a.y === it.b.y);
    const ys = new Set(lines.map((l) => l.a.y));
    for (const c of SHOWN_LEVELS) expect(ys.has(coords.priceToY(fibLevelPrice(d.points, c))!)).toBe(true);
    // Labels as percents, with the level price.
    const label = `61.80% (${fibLevelPrice(d.points, 0.618).toFixed(2)})`;
    expect(flat(sceneFor(d)).some((it) => it.t === "text" && it.text === label)).toBe(true);
  });

  it("text note: anchor on the bar's high, label above on the same bar, the text drawn", () => {
    const nd = barNote(bars, 45, "Top");
    const d = validate(nd);
    if (d.kind !== "note") throw new Error(d.kind);
    expect(d.points[0]).toEqual({ time: bars[45].time, price: bars[45].high });
    expect(d.points[1].time).toBe(bars[45].time);
    expect(d.points[1].price).toBeGreaterThan(d.points[0].price);
    expect(d.text).toBe("Top");
    expect(flat(sceneFor(d)).some((it) => it.t === "text" && it.text === "Top")).toBe(true);
  });

  it("text note: the host editor writes the text back on textEdit", () => {
    const listeners = new Set<(d: Drawing) => void>();
    const updated: Drawing[] = [];
    const fake = {
      on: (_e: string, cb: (d: Drawing) => void) => { listeners.add(cb); return () => listeners.delete(cb); },
      update: (d: Drawing) => updated.push(d),
    } as unknown as DrawingManager;
    const off = editTextOnPlacement(fake, (cur) => `${cur}!`);
    for (const cb of listeners) cb(asDrawing(barNote(bars, 10, "Low"), "dw_note"));
    expect(updated[0].text).toBe("Low!");
    off();
    expect(listeners.size).toBe(0);
  });
});

/** The tool reference of the skill, generated from OVERLAY_SPECS (`npx vitest run -u` rewrites it). */
function toolsReference(): string {
  const val = (v: unknown): string => {
    if (Array.isArray(v)) {
      const vis = v.filter((x) => (x as { visible?: boolean }).visible !== false).length;
      return `[${v.length}${vis !== v.length ? `, ${vis} visible` : ""}]`;
    }
    if (v && typeof v === "object") return "{…}";
    return typeof v === "string" ? v : String(v);
  };
  const rows = (Object.keys(OVERLAY_SPECS) as DrawingKind[]).map((kind) => {
    const s = OVERLAY_SPECS[kind];
    const placement = kind === "image"
      ? "host: `addImage`"
      : s.freehand ? "press, drag, release"
      : s.variableLength ? `${s.pointCount}+ clicks, double-click to finish`
      : `${s.pointCount} click${s.pointCount === 1 ? "" : "s"}`;
    const stored = s.freehand ? "sampled" : s.variableLength ? "= clicks" : String(storedPointCount(kind));
    const defaults = Object.entries(s.defaults ?? {}).map(([k, v]) => `${k} ${val(v)}`).join(", ");
    return `| \`${kind}\` | ${placement} | ${stored} | ${s.textEditable ? "yes" : ""} | ${defaults} |`;
  });
  return [
    "# Tool reference",
    "",
    "Generated from `OVERLAY_SPECS` (src/core/specs.ts) by test/skill-examples.test.ts. Do not edit:",
    "run `npx vitest run -u` after changing a spec.",
    "",
    `${rows.length} tools. **Placement**: clicks the user makes (\`spec.pointCount\`). **Points**: length of`,
    "`drawing.points` once placed (`buildNewDrawing`); pass that many points to `add`. **Text**: the tool",
    "carries a `text` field and fires `textEdit`. **Defaults**: the tool's style on top of `DEFAULT_STYLE`",
    "(color #2962ff, width 1, lineStyle solid); arrays show their length (and visible entries).",
    "",
    "| kind | Placement | Points | Text | Defaults |",
    "|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
}

describe("skill tool reference", () => {
  it("matches the specs", async () => {
    await expect(toolsReference()).toMatchFileSnapshot("../skills/lightweight-charts-drawing/references/tools.md");
  });
});
