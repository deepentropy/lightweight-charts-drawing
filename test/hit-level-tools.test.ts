// The level / grid tools (fib retracement, trend-based fib extension, Gann box, Gann square,
// Gann square fixed) hit only on their drawn lines; the gaps between the lines are a background hit
// (a mouse press there pans the chart, selected or not), null without the fill. The box tools
// (price / date / date-and-price range, long / short position) hit like the rectangle: the drawn
// lines are the body, the inside is a background hit while unselected and the body while selected.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Time } from "lightweight-charts";
import { defaultStyleFor, fibLevelAt, hitTestKind, sceneOf, type Coords, type Drawing, type DrawingStyle, type HitResult, type Pt } from "../src";
import { ptr, setup } from "./pointer-harness";

afterEach(() => vi.unstubAllGlobals());

const W = 800;
const H = 500;
const BG: HitResult = { hit: "body", background: true };
const BODY: HitResult = { hit: "body" };

/** x = time, y = 500 - price (bar index = time), like the pointer harness. */
function makeCoords(over: Partial<Coords> = {}): Coords {
  return {
    priceToY: (p) => H - p,
    yToPrice: (y) => H - y,
    isLog: () => false,
    timeToX: (t) => t as number,
    xToTime: (x) => x as Time,
    barAt: () => null,
    timeToBarIndex: (t) => t as number,
    barIndexToTime: (i) => i as Time,
    bars: () => [],
    visibleTimeRange: () => null,
    indicatorValuesAt: () => [],
    pipSize: () => 0.01,
    addPriceLine: () => {
      throw new Error("not used");
    },
    removePriceLine: () => {},
    zoomToScreenRect: () => {},
    formatTime: (t) => String(t),
    timeAxis: () => ({ height: 28, width: W, fontSize: 12, fontFamily: "sans-serif" }),
    timeInfo: () => ({ timeZone: "UTC", intraday: false }),
    ...over,
  };
}
const LIN = makeCoords();

function dr(kind: Drawing["kind"], points: [number, number][], style: Partial<DrawingStyle> = {}): Drawing {
  return {
    id: kind,
    kind,
    points: points.map(([time, price]) => ({ time: time as Time, price })),
    style: { ...defaultStyleFor(kind), ...style },
  } as Drawing;
}
const proj = (d: Drawing, c: Coords): Pt[] => d.points.map((p) => ({ x: c.timeToX(p.time)!, y: c.priceToY(p.price)! }));
function hit(d: Drawing, cursor: Pt, o: { selected?: boolean; coords?: Coords; tolerance?: number } = {}): HitResult | null {
  const c = o.coords ?? LIN;
  return hitTestKind(d, proj(d, c), cursor, W, H, c, !!o.selected, o.tolerance);
}
/** Unselected and selected give the same hit. */
function both(d: Drawing, cursor: Pt, o: { coords?: Coords } = {}): HitResult | null {
  const a = hit(d, cursor, o);
  expect(hit(d, cursor, { ...o, selected: true })).toEqual(a);
  return a;
}

/** The horizontal level lines the scene draws (non-inert lines, sorted by y). */
function sceneLevelYs(d: Drawing, c: Coords): number[] {
  // The labels measure text through a canvas (none in node: the fallback width).
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => null }) });
  const ys: number[] = [];
  const walk = (items: ReturnType<typeof sceneOf>) => {
    for (const it of items) {
      if (it.t === "group") walk(it.items);
      else if (it.t === "line" && !it.inert && Math.abs(it.a.y - it.b.y) < 1e-9) ys.push(it.a.y);
    }
  };
  walk(sceneOf(d, proj(d, c), { w: W, h: H, coords: c, selected: false }));
  return [...new Set(ys)].filter(Number.isFinite).sort((a, b) => a - b);
}

describe("fib retracement", () => {
  // Levels at y = 100 + 300·coeff: 0 → 100, 0.236 → 170.8, 0.382 → 214.6, …, 1 → 400.
  const fib = (style: Partial<DrawingStyle> = {}) => dr("fib-retracement", [[100, 100], [300, 400]], style);

  it("between two levels: a background hit, selected or not; null without the fill", () => {
    expect(both(fib(), { x: 200, y: 190 })).toEqual(BG);
    expect(both(fib({ fillBackground: false }), { x: 200, y: 190 })).toBeNull();
  });

  it("on a level line: the body (with the fill on or off)", () => {
    expect(both(fib(), { x: 200, y: 250 })).toEqual(BODY);
    expect(both(fib(), { x: 200, y: 214.6 + 5 })).toEqual(BODY);
    expect(both(fib({ fillBackground: false }), { x: 200, y: 250 })).toEqual(BODY);
  });

  it("the anchors win over the levels", () => {
    expect(hit(fib(), { x: 100, y: 400 })).toEqual({ hit: "handle", handleIndex: 0 });
    expect(hit(fib(), { x: 300, y: 100 })).toEqual({ hit: "handle", handleIndex: 1 });
  });

  it("outside the levels' x-range: nothing; with extend right the levels run to the pane edge", () => {
    expect(hit(fib(), { x: 400, y: 250 })).toBeNull();
    expect(hit(fib(), { x: 400, y: 190 })).toBeNull();
    expect(hit(fib({ extendRight: true }), { x: 700, y: 250 })).toEqual(BODY);
    expect(hit(fib({ extendRight: true }), { x: 700, y: 190 })).toEqual(BG);
  });

  it("the trend line (inert in the scene) is not a target off the levels", () => {
    // (200, 250) is on the 0.5 level; the diagonal p0 → p1 crosses y = 190 at x = 170.
    expect(hit(fib(), { x: 170, y: 190 })).toEqual(BG);
  });

  it("levels above 1 count: the band runs to the highest visible level, not the anchors", () => {
    // y = 100 + 100·coeff: 1 → 200, 1.618 → 261.8, 2.618 → 361.8, 4.236 → 523.6.
    const d = dr("fib-retracement", [[100, 300], [300, 400]]);
    expect(hit(d, { x: 200, y: 230 })).toEqual(BG);
    expect(hit(d, { x: 200, y: 361.8 })).toEqual(BODY);
    expect(hit(d, { x: 200, y: 261.8 + 4 })).toEqual(BODY);
    // Without the far levels the band ends at 1.
    const near = (defaultStyleFor("fib-retracement").levels ?? []).map((l) => ({ ...l, visible: l.visible && l.coeff <= 1 }));
    expect(hit(dr("fib-retracement", [[100, 300], [300, 400]], { levels: near }), { x: 200, y: 230 })).toBeNull();
  });

  it("follows the drawn level y: every scene level line is a body hit, midway between two is the fill", () => {
    const LOG = makeCoords({ isLog: () => true, priceToY: (p) => H - 50 * Math.log(p), yToPrice: (y) => Math.exp((H - y) / 50) });
    const cases: [Drawing, Coords][] = [
      [dr("fib-retracement", [[100, 100], [300, 1000]]), LOG],
      [dr("fib-retracement", [[100, 100], [300, 1000]], { fibLevelsBasedOnLogScale: true }), LOG],
      [dr("fib-retracement", [[100, 300], [300, 400]], { reverse: true }), LIN],
    ];
    for (const [d, c] of cases) {
      const ys = sceneLevelYs(d, c);
      expect(ys.length).toBeGreaterThan(5);
      for (const y of ys) expect(hit(d, { x: 200, y }, { coords: c })).toEqual(BODY);
      for (let i = 1; i < ys.length; i++) {
        if (ys[i] - ys[i - 1] > 14) expect(hit(d, { x: 200, y: (ys[i] + ys[i - 1]) / 2 }, { coords: c })).toEqual(BG);
      }
      expect(hit(d, { x: 200, y: ys[0] - 10 }, { coords: c })).toBeNull();
      expect(hit(d, { x: 200, y: ys[ys.length - 1] + 10 }, { coords: c })).toBeNull();
    }
  });

  it("log scale: the 0.5 level sits where the option puts it", () => {
    const LOG = makeCoords({ isLog: () => true, priceToY: (p) => H - 50 * Math.log(p), yToPrice: (y) => Math.exp((H - y) / 50) });
    const yA = H - 50 * Math.log(100);
    const yB = H - 50 * Math.log(1000);
    const yPrice = H - 50 * Math.log(550); // 0.5 = price 550, through the log scale
    const yMid = (yA + yB) / 2; // log-based: halfway in ln(price) = halfway on screen
    const lin = dr("fib-retracement", [[100, 100], [300, 1000]]);
    const log = dr("fib-retracement", [[100, 100], [300, 1000]], { fibLevelsBasedOnLogScale: true });
    expect(hit(lin, { x: 200, y: yPrice }, { coords: LOG })).toEqual(BODY);
    expect(hit(log, { x: 200, y: yMid }, { coords: LOG })).toEqual(BODY);
    // A level of one mode that is a gap in the other.
    const far = (y: number, ys: number[]) => ys.every((v) => Math.abs(v - y) > 8);
    const linYs = sceneLevelYs(lin, LOG);
    const logYs = sceneLevelYs(log, LOG);
    const y = logYs.find((v) => v > Math.min(...linYs) && v < Math.max(...linYs) && far(v, linYs))!;
    expect(y).toBeDefined();
    expect(hit(log, { x: 200, y }, { coords: LOG })).toEqual(BODY);
    expect(hit(lin, { x: 200, y }, { coords: LOG })).toEqual(BG);
  });

  it("reverse: the ladder starts at the first point", () => {
    // y = 200 − 100·coeff: 1.618 → 38.2; nothing below the first point.
    const d = dr("fib-retracement", [[100, 300], [300, 400]], { reverse: true });
    expect(hit(d, { x: 200, y: 38.2 })).toEqual(BODY);
    expect(hit(d, { x: 200, y: 300 })).toBeNull();
  });

  it("fibLevelAt reads the same levels", () => {
    const d = fib({ extendRight: true });
    expect(fibLevelAt(d, proj(d, LIN), { x: 600, y: 252 }, W, LIN)).toEqual({ index: 3, y: 250, left: 100, right: W, textX: (100 + W) / 2 });
    expect(fibLevelAt(d, proj(d, LIN), { x: 600, y: 190 }, W, LIN)).toBeNull();
  });

  it("a touch tolerance widens the level lines", () => {
    expect(hit(fib(), { x: 200, y: 262 })).toEqual(BG);
    expect(hit(fib(), { x: 200, y: 262 }, { tolerance: 16 })).toEqual(BODY);
  });
});

describe("trend-based fib extension", () => {
  // Move 300 → 400 projected from 350 over x 200..300: y = 150 − 100·coeff (0 → 150, 0.236 → 126.4, 1 → 50).
  const ext = (style: Partial<DrawingStyle> = {}) => dr("trend-based-fib-extension", [[100, 300], [200, 400], [300, 350]], style);

  it("inside its box between two levels: background, selected or not; null without the fill", () => {
    expect(both(ext(), { x: 250, y: 140 })).toEqual(BG);
    expect(both(ext({ fillBackground: false }), { x: 250, y: 140 })).toBeNull();
  });
  it("on a level: the body; outside the levels: nothing", () => {
    expect(both(ext(), { x: 250, y: 126.4 })).toEqual(BODY);
    expect(hit(ext(), { x: 250, y: 190 })).toBeNull(); // below level 0, inside the anchors' old box
    expect(hit(ext(), { x: 150, y: 140 })).toBeNull(); // left of point 2
  });
  it("the anchors win", () => {
    expect(hit(ext(), { x: 300, y: 150 })).toEqual({ hit: "handle", handleIndex: 2 });
  });
  it("matches the scene's level lines", () => {
    const d = ext();
    const ys = sceneLevelYs(d, LIN);
    for (const y of ys) expect(hit(d, { x: 250, y })).toEqual(BODY);
  });
});

describe("gann box", () => {
  // Box x 100..300, y 200..400; levels at 0, .25, .382, .5, .618, .75, 1 on both axes.
  const box = (style: Partial<DrawingStyle> = {}) => dr("gann-box", [[100, 100], [300, 300]], style);

  it("between the levels: background, selected or not; either fill on is enough", () => {
    expect(both(box(), { x: 120, y: 375 })).toEqual(BG);
    expect(both(box({ fillBackground: false }), { x: 120, y: 375 })).toEqual(BG);
    expect(both(box({ fillVertBackground: false }), { x: 120, y: 375 })).toEqual(BG);
    expect(both(box({ fillBackground: false, fillVertBackground: false }), { x: 120, y: 375 })).toBeNull();
  });
  it("on a price level, a time level or the border: the body", () => {
    expect(both(box(), { x: 120, y: 350 })).toEqual(BODY);
    expect(both(box(), { x: 150, y: 375 })).toEqual(BODY);
    expect(both(box(), { x: 120, y: 401 })).toEqual(BODY);
  });
  it("the corners are the handles; outside nothing", () => {
    expect(hit(box(), { x: 100, y: 200 })).toEqual({ hit: "handle", handleIndex: 0 });
    expect(hit(box(), { x: 300, y: 400 })).toEqual({ hit: "handle", handleIndex: 2 });
    expect(hit(box(), { x: 320, y: 375 })).toBeNull();
  });
  it("the angle lines hit when shown", () => {
    // Fan from (100, 400) to (300, 200) along the diagonal (coeff 1 → x = 300).
    expect(hit(box(), { x: 130, y: 370 })).toEqual(BG);
    expect(hit(box({ fans: { visible: true, color: "#9C9C9C" } }), { x: 130, y: 370 })).toEqual(BODY);
  });
});

describe("gann square / gann square fixed", () => {
  // Frame start (100, 400), end (300, 200); grid every 40 px.
  const sq = (style: Partial<DrawingStyle> = {}) => dr("gann-square", [[100, 100], [300, 300]], style);
  const hide = <T extends { visible: boolean }>(xs: T[] | undefined) => (xs ?? []).map((x) => ({ ...x, visible: false }));
  const dflt = defaultStyleFor("gann-square");

  it("an empty spot inside: background, selected or not; null without the fill", () => {
    expect(both(sq(), { x: 290, y: 230 })).toEqual(BG);
    expect(both(sq({ fillBackground: false }), { x: 290, y: 230 })).toBeNull();
  });
  it("level, fan and arc lines are the body", () => {
    expect(both(sq(), { x: 290, y: 240 })).toEqual(BODY); // level y = 240
    expect(both(sq(), { x: 260, y: 230 })).toEqual(BODY); // level x = 260
    // Only the fans: the 1×1 diagonal.
    const fans = sq({ gannLevels: hide(dflt.gannLevels), gannArcs: hide(dflt.gannArcs) });
    expect(hit(fans, { x: 250, y: 250 })).toEqual(BODY);
    expect(hit(fans, { x: 250, y: 270 })).toEqual(BG);
    // Only the arcs: radius 40 and 56.6 round the start (the box is a square: circles).
    const arcs = sq({ gannLevels: hide(dflt.gannLevels), gannFans: hide(dflt.gannFans) });
    const at = (r: number, deg: number) => ({ x: 100 + r * Math.cos((deg * Math.PI) / 180), y: 400 - r * Math.sin((deg * Math.PI) / 180) });
    expect(hit(arcs, at(56.57, 60))).toEqual(BODY);
    expect(hit(arcs, at(48, 60))).toEqual(BG);
  });
  it("the anchors win; outside the box nothing", () => {
    expect(hit(sq(), { x: 100, y: 400 })).toEqual({ hit: "handle", handleIndex: 0 });
    expect(hit(sq(), { x: 320, y: 230 })).toBeNull();
  });
  it("gann square fixed: the gaps are background, the grid the body", () => {
    // p0 (100, 400), p1 (110, 390): a = 14.14, box 70.7 px to (170.7, 329.3), grid every 14.14 px.
    const fx = (style: Partial<DrawingStyle> = {}) => dr("gann-square-fixed", [[100, 100], [110, 110]], { gannFans: hide(dflt.gannFans), gannArcs: hide(dflt.gannArcs), ...style });
    expect(both(fx(), { x: 100 + 3 * 14.142 + 7, y: 400 - 7 })).toEqual(BG);
    expect(both(fx(), { x: 100 + 3 * 14.142, y: 400 - 7 })).toEqual(BODY);
    expect(both(fx({ fillBackground: false }), { x: 100 + 3 * 14.142 + 7, y: 400 - 7 })).toBeNull();
  });
});

describe("fib circles", () => {
  // Centre (200, 300) = the p0-p1 midpoint, half-axes 100 × 100 · coeff: rings at 23.6, 38.2, 50,
  // 61.8, 78.6, 100, 161.8, …, 461.8 px.
  const fc = (style: Partial<DrawingStyle> = {}, pts: [number, number][] = [[100, 100], [300, 300]]) =>
    ({ ...dr("fib-circles", pts, style), fmt: 2 }) as Drawing;

  it("between two rings and inside the innermost: background, selected or not; null without the fill", () => {
    expect(both(fc(), { x: 330, y: 300 })).toEqual(BG);
    expect(both(fc(), { x: 205, y: 300 })).toEqual(BG);
    expect(both(fc({ fillBackground: false }), { x: 330, y: 300 })).toBeNull();
    expect(both(fc({ fillBackground: false }), { x: 205, y: 300 })).toBeNull();
  });
  it("on a ring: the body; outside the outer ring: nothing", () => {
    expect(both(fc(), { x: 300, y: 300 })).toEqual(BODY);
    expect(both(fc(), { x: 200, y: 361.8 + 3 })).toEqual(BODY);
    expect(both(fc({ fillBackground: false }), { x: 300, y: 300 })).toEqual(BODY);
    expect(hit(fc(), { x: 200 + 480, y: 300 })).toBeNull();
  });
  it("an ellipse: the rings follow both half-axes", () => {
    // p0 (100, 400), p1 (300, 300): centre (200, 350), half-axes 100 × 50 · coeff.
    const d = fc({}, [[100, 100], [300, 200]]);
    expect(hit(d, { x: 300, y: 350 })).toEqual(BODY);
    expect(hit(d, { x: 200, y: 300 })).toEqual(BODY);
    expect(hit(d, { x: 330, y: 350 })).toEqual(BG);
    expect(hit(d, { x: 200, y: 285 })).toEqual(BG);
  });
  it("the anchors win", () => {
    expect(hit(fc(), { x: 100, y: 400 })).toEqual({ hit: "handle", handleIndex: 0 });
    expect(hit(fc(), { x: 300, y: 200 })).toEqual({ hit: "handle", handleIndex: 1 });
  });
  it("a touch tolerance widens the rings", () => {
    expect(hit(fc(), { x: 310, y: 300 })).toEqual(BG);
    expect(hit(fc(), { x: 310, y: 300 }, { tolerance: 16 })).toEqual(BODY);
  });
});

describe("box tools: the rectangle model", () => {
  const sel = (d: Drawing, c: Pt) => hit(d, c, { selected: true });

  it("price range: edges + distance line = body, inside = background / body when selected", () => {
    // x 100..300, y 200..400, distance line at x = 200.
    const d = dr("price-range", [[100, 300], [300, 100]]);
    expect(hit(d, { x: 150, y: 300 })).toEqual(BG);
    expect(sel(d, { x: 150, y: 300 })).toEqual(BODY);
    expect(hit(d, { x: 150, y: 201 })).toEqual(BODY);
    expect(hit(d, { x: 200, y: 300 })).toEqual(BODY);
    expect(hit(d, { x: 100, y: 200 })).toEqual({ hit: "handle", handleIndex: 0 });
    expect(hit(d, { x: 350, y: 300 })).toBeNull();
    // Fill off: the inside is no target, selected or not (the rectangle); the lines still hit.
    const off = dr("price-range", [[100, 300], [300, 100]], { fillBackground: false });
    expect(both(off, { x: 150, y: 300 })).toBeNull();
    expect(both(off, { x: 200, y: 300 })).toEqual(BODY);
    expect(both(dr("date-range", [[100, 300], [300, 100]], { fillBackground: false }), { x: 150, y: 250 })).toBeNull();
    expect(both(dr("date-and-price-range", [[100, 300], [300, 100]], { fillBackground: false }), { x: 150, y: 250 })).toBeNull();
    expect(hit(dr("price-range", [[100, 300], [300, 100]], { extendRight: true }), { x: 600, y: 300 })).toEqual(BG);
  });

  it("date range: edges + distance line = body, inside = background / body when selected; extendTop", () => {
    const d = dr("date-range", [[100, 300], [300, 100]]);
    expect(hit(d, { x: 150, y: 250 })).toEqual(BG);
    expect(sel(d, { x: 150, y: 250 })).toEqual(BODY);
    expect(hit(d, { x: 101, y: 250 })).toEqual(BODY);
    expect(hit(d, { x: 150, y: 300 })).toEqual(BODY);
    expect(hit(d, { x: 150, y: 50 })).toBeNull();
    expect(hit(dr("date-range", [[100, 300], [300, 100]], { extendTop: true }), { x: 150, y: 50 })).toEqual(BG);
  });

  it("date and price range: the distance lines = body, inside = background / body when selected", () => {
    const d = dr("date-and-price-range", [[100, 300], [300, 100]]);
    expect(hit(d, { x: 150, y: 250 })).toEqual(BG);
    expect(sel(d, { x: 150, y: 250 })).toEqual(BODY);
    expect(hit(d, { x: 150, y: 300 })).toEqual(BODY);
    expect(hit(d, { x: 200, y: 250 })).toEqual(BODY);
    expect(hit(d, { x: 300, y: 400 })).toEqual({ hit: "handle", handleIndex: 1 });
    expect(hit(d, { x: 350, y: 250 })).toBeNull();
  });

  it.each(["long-position", "short-position"] as const)("%s: the lines = body, inside = background / body when selected", (kind) => {
    // Entry 300 (y 200) to the close at x 300; target / stop 100 / 50 away.
    const d = dr(kind, [[100, 300], [300, 300]], { profitLevel: 100, stopLevel: 50 });
    const yT = kind === "long-position" ? 100 : 300;
    const yS = kind === "long-position" ? 250 : 150;
    const inside = { x: 150, y: (yT + 200) / 2 };
    expect(hit(d, inside)).toEqual(BG);
    expect(sel(d, inside)).toEqual(BODY);
    expect(hit(d, { x: 150, y: (yS + 200) / 2 })).toEqual(BG);
    expect(hit(d, { x: 150, y: 201 })).toEqual(BODY);
    expect(hit(d, { x: 150, y: yT })).toEqual(BODY);
    expect(hit(d, { x: 150, y: yS })).toEqual(BODY);
    expect(hit(d, { x: 100, y: 200 })).toEqual({ hit: "handle", handleIndex: 0 });
    expect(hit(d, { x: 100, y: yS })).toEqual({ hit: "handle", handleIndex: 2 });
    expect(hit(d, { x: 350, y: 200 })).toBeNull();
  });
});

describe("DrawingManager: a mouse press between fib levels pans", () => {
  /** Fib (100, 400) → (300, 100): levels at y 100, 170.8, 214.6, 250, …; (200, 190) is between two. */
  function scene() {
    const s = setup();
    const id = s.dm.add({ kind: "fib-retracement", points: [{ time: 100 as never, price: 100 }, { time: 300 as never, price: 400 }] });
    return { s, id };
  }
  const press = (s: ReturnType<typeof setup>, type: string, x: number, y: number) => {
    const down = ptr("pointerdown", type, x, y);
    const stop = vi.spyOn(down, "stopPropagation");
    s.el.dispatchEvent(down);
    s.doc.dispatchEvent(ptr("pointerup", type, x, y));
    s.win.dispatchEvent(ptr("pointerup", type, x, y));
    return stop;
  };

  it("unselected: the press passes through to the chart", () => {
    const { s } = scene();
    const stop = press(s, "mouse", 200, 190);
    expect(stop).not.toHaveBeenCalled();
    expect(s.chart.applyOptions).not.toHaveBeenCalled();
    expect(s.dm.selection()).toEqual([]);
  });
  it("selected: the press still passes through (the chart pans), a level line still grabs it", () => {
    const { s, id } = scene();
    s.dm.select([id]);
    s.chart.applyOptions.mockClear();
    const stop = press(s, "mouse", 200, 190);
    expect(stop).not.toHaveBeenCalled();
    expect(s.chart.applyOptions).not.toHaveBeenCalled();
    expect(press(s, "mouse", 200, 250)).toHaveBeenCalled();
  });
  it("a touch between the levels selects it", () => {
    const { s, id } = scene();
    press(s, "touch", 200, 190);
    expect(s.dm.selection()).toEqual([id]);
  });
});
