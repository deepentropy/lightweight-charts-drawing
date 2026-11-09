/**
 * formatLabel `caption`: the fixed words the scenes draw (pattern names, forecast status, placeholders).
 * Self-contained harness (mirrors test/labels.test.ts; does not import from it).
 */
import { describe, expect, it } from "vitest";
import type { Time } from "lightweight-charts";
import {
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

function textsOf(d: Drawing, c: Coords, selected = false): string[] {
  return flat(sceneOf(d, project(d, c), { w: W, h: H, coords: c, selected }))
    .filter((it): it is Extract<SceneItem, { t: "text" }> => it.t === "text")
    .map((it) => it.text);
}

/** Every caption upper-cased by the hook, the other labels kept. */
function shouting(seen: DrawingLabel[]): LabelFormatter {
  return (l) => {
    seen.push(l);
    return l.id === "caption" ? `<${l.text.toUpperCase()}>` : undefined;
  };
}

describe("formatLabel hook (caption)", () => {
  it("head and shoulders: the three point names, with the drawing's kind", () => {
    const seen: DrawingLabel[] = [];
    const c = baseCoords({ formatLabel: shouting(seen) });
    const d = drawing("head-and-shoulders", [pt(5, 100), pt(10, 115), pt(15, 105), pt(20, 125), pt(25, 105), pt(30, 115), pt(35, 100)]);
    const texts = textsOf(d, c);
    expect(texts).toEqual(expect.arrayContaining(["<LEFT SHOULDER>", "<HEAD>", "<RIGHT SHOULDER>"]));
    expect(seen.filter((l) => l.id === "caption").every((l) => l.kind === "head-and-shoulders")).toBe(true);
  });

  it("empty text drawings: the placeholder, measured as drawn (scene and hit test agree)", () => {
    const seen: DrawingLabel[] = [];
    const c = baseCoords({ formatLabel: shouting(seen) });
    const callout = drawing("callout", [pt(10, 100), pt(20, 120)]);
    expect(textsOf(callout, c)).toContain("<ADD TEXT>");
    const note = drawing("note", [pt(10, 100), pt(20, 120)]);
    expect(textsOf(note, c)).toContain("<ADD TEXT>");
    // The hook's text is wider: the box hit at its right edge only exists with the hook.
    const plain = baseCoords();
    const p = project(callout, c);
    const inPlain = flat(sceneOf(callout, p, { w: W, h: H, coords: plain, selected: false }));
    const inHook = flat(sceneOf(callout, p, { w: W, h: H, coords: c, selected: false }));
    expect(JSON.stringify(inHook)).not.toEqual(JSON.stringify(inPlain));
    expect(hitTestKind(callout, p, p[1], W, H, c)).not.toBeNull();
  });

  it("user text is not a caption", () => {
    const seen: DrawingLabel[] = [];
    const c = baseCoords({ formatLabel: shouting(seen) });
    const d = { ...drawing("callout", [pt(10, 100), pt(20, 120)]), text: "Head" } as Drawing;
    expect(textsOf(d, c)).toContain("Head");
    expect(seen.some((l) => l.id === "caption")).toBe(false);
  });

  it("forecast status banner", () => {
    const seen: DrawingLabel[] = [];
    const c = baseCoords({ formatLabel: shouting(seen) });
    // From bar 16 (low) to bar 30 (higher), which the bars after it reach: success.
    const texts = textsOf(drawing("position-forecast", [pt(16, 106), pt(20, 110)]), c);
    expect(texts.some((t) => t === "<SUCCESS>" || t === "<FAILURE>")).toBe(true);
  });

  it("without a hook the words are unchanged", () => {
    const c = baseCoords();
    const d = drawing("head-and-shoulders", [pt(5, 100), pt(10, 115), pt(15, 105), pt(20, 125), pt(25, 105), pt(30, 115), pt(35, 100)]);
    expect(textsOf(d, c)).toEqual(expect.arrayContaining(["Left Shoulder", "Head", "Right Shoulder"]));
    expect(textsOf(drawing("callout", [pt(10, 100), pt(20, 120)]), c)).toContain("Add text");
  });
});
