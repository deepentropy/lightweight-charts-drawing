// #30: a filled area hits only while its fill is drawn, and its fill ranks below the strokes,
// handles and text of every drawing (TV background hits), so a filled shape on top never hides
// the lines under it. The outline still hits with the fill off.
// #31: the manager counts a fill only for touch; a mouse press on it passes through to the chart.
// #32: a selected rectangle, circle or ellipse is grabbed by its fill.
// #40: level / grid tools hit their lines, not their box; range and position boxes follow #32.
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultStyleFor, hitTestKind, pickTopmostHit, type Drawing, type DrawingStyle, type HitResult, type Pt } from "../src";
import { OFF, ptr, setup } from "./pointer-harness";

afterEach(() => vi.unstubAllGlobals());

const W = 800;
const H = 500;
const BG: HitResult = { hit: "body", background: true };
const BODY: HitResult = { hit: "body" };

function d(kind: Drawing["kind"], style: Partial<DrawingStyle> = {}): Drawing {
  return { id: kind, kind, points: [], style: { ...defaultStyleFor(kind), ...style } } as unknown as Drawing;
}
const hit = (dr: Drawing, pts: Pt[], c: Pt) => hitTestKind(dr, pts, c, W, H, null);

// Each shape: screen points, a point on its outline, a point deep inside.
const SHAPES: { kind: Drawing["kind"]; pts: Pt[]; edge: Pt; inside: Pt }[] = [
  { kind: "rectangle", pts: [{ x: 100, y: 100 }, { x: 300, y: 300 }], edge: { x: 150, y: 101 }, inside: { x: 150, y: 250 } },
  { kind: "circle", pts: [{ x: 300, y: 250 }, { x: 400, y: 250 }], edge: { x: 300, y: 151 }, inside: { x: 320, y: 280 } },
  { kind: "ellipse", pts: [{ x: 200, y: 250 }, { x: 400, y: 250 }, { x: 300, y: 330 }], edge: { x: 300, y: 171 }, inside: { x: 260, y: 230 } },
  { kind: "triangle", pts: [{ x: 100, y: 400 }, { x: 300, y: 100 }, { x: 500, y: 400 }], edge: { x: 300, y: 401 }, inside: { x: 300, y: 300 } },
  { kind: "rotated-rectangle", pts: [{ x: 100, y: 200 }, { x: 300, y: 200 }, { x: 200, y: 300 }], edge: { x: 200, y: 201 }, inside: { x: 200, y: 250 } },
  { kind: "sector", pts: [{ x: 300, y: 300 }, { x: 450, y: 300 }, { x: 300, y: 150 }], edge: { x: 400, y: 299 }, inside: { x: 350, y: 250 } },
];

describe("filled shapes (#30)", () => {
  for (const s of SHAPES) {
    it(`${s.kind}: outline = body, inside = background, nothing inside without the fill`, () => {
      expect(hit(d(s.kind), s.pts, s.edge)).toEqual(BODY);
      expect(hit(d(s.kind), s.pts, s.inside)).toEqual(BG);
      expect(hit(d(s.kind, { fillBackground: false }), s.pts, s.edge)).toEqual(BODY);
      expect(hit(d(s.kind, { fillBackground: false }), s.pts, s.inside)).toBeNull();
    });
  }

  it("selected rectangle, circle and ellipse: the fill is the body; the other shapes keep a background fill (#32)", () => {
    const sel = (dr: Drawing, pts: Pt[], c: Pt) => hitTestKind(dr, pts, c, W, H, null, true);
    for (const s of SHAPES) {
      const grabbed = s.kind === "rectangle" || s.kind === "circle" || s.kind === "ellipse";
      expect(sel(d(s.kind), s.pts, s.inside)).toEqual(grabbed ? BODY : BG);
      expect(sel(d(s.kind, { fillBackground: false }), s.pts, s.inside)).toBeNull();
    }
  });

  it("rectangle: anchors still win, the extended box hits up to the pane edge", () => {
    const pts = [{ x: 100, y: 100 }, { x: 300, y: 300 }];
    expect(hit(d("rectangle"), pts, { x: 100, y: 100 })).toEqual({ hit: "handle", handleIndex: 0 });
    expect(hit(d("rectangle"), pts, { x: 200, y: 300 })).toEqual({ hit: "handle", handleIndex: 6 });
    expect(hit(d("rectangle", { extendRight: true }), pts, { x: 700, y: 200 })).toEqual(BG);
    expect(hit(d("rectangle", { extendRight: true }), pts, { x: 700, y: 300 })).toEqual(BODY);
    expect(hit(d("rectangle", { extendRight: true, fillBackground: false }), pts, { x: 700, y: 200 })).toBeNull();
  });

  it("channels and patterns: the band / fill is a background hit, the lines are not", () => {
    const pc = [{ x: 100, y: 200 }, { x: 400, y: 200 }, { x: 100, y: 300 }];
    expect(hit(d("parallel-channel"), pc, { x: 200, y: 200 })).toEqual(BODY);
    expect(hit(d("parallel-channel"), pc, { x: 250, y: 230 })).toEqual(BG);
    const tp = [{ x: 100, y: 300 }, { x: 200, y: 100 }, { x: 300, y: 300 }, { x: 200, y: 400 }];
    expect(hit(d("triangle-pattern"), tp, { x: 200, y: 250 })).toEqual(BG);
    expect(hit(d("triangle-pattern", { fillBackground: false }), tp, { x: 200, y: 250 })).toBeNull();
  });
});

// #40: level and grid tools (fib retracement / extension / circles, Gann box / squares): the
// drawn lines are the body, the gaps a background hit while the fill is on, selected or not.
// Box tools (ranges, positions): the lines are the body, the box a background hit, the body
// while selected (like the rectangle).
describe("level, grid and box tools (#40)", () => {
  /** A drawing with `n` data points (the prices only matter with coords). */
  function dp(kind: Drawing["kind"], n: number, style: Partial<DrawingStyle> = {}, extra: Partial<Drawing> = {}): Drawing {
    const points = Array.from({ length: n }, (_, i) => ({ time: i, price: 100 + 10 * i }));
    return { ...d(kind, style), points, ...extra } as Drawing;
  }
  const sel = (dr: Drawing, pts: Pt[], c: Pt) => hitTestKind(dr, pts, c, W, H, null, true);

  // Level / grid tools: [drawing, screen points, a point on a line, a point in a gap, the fill off].
  const LEVELS: { name: string; mk: (s?: Partial<DrawingStyle>) => Drawing; pts: Pt[]; line: Pt; gap: Pt; off: Partial<DrawingStyle> }[] = [
    // y = 400 − 150·coeff over x 100..300: 0.5 → 325, 0.382 → 342.7.
    { name: "fib-retracement", mk: (s) => dp("fib-retracement", 2, s), pts: [{ x: 100, y: 250 }, { x: 300, y: 400 }], line: { x: 150, y: 325 }, gap: { x: 150, y: 335 }, off: { fillBackground: false } },
    // y = 350 − 100·coeff over x 200..250: 0.5 → 300, 0.618 → 288.2, 0.786 → 271.4.
    { name: "trend-based-fib-extension", mk: (s) => dp("trend-based-fib-extension", 3, s), pts: [{ x: 100, y: 400 }, { x: 200, y: 300 }, { x: 250, y: 350 }], line: { x: 225, y: 300 }, gap: { x: 225, y: 280 }, off: { fillBackground: false } },
    // Ellipses around (300, 250), half-axes 100·coeff × 50·coeff: ring 1 at x 400, ring 0.786 at x 378.6.
    { name: "fib-circles", mk: (s) => dp("fib-circles", 2, s, { fmt: 2 }), pts: [{ x: 200, y: 200 }, { x: 400, y: 300 }], line: { x: 400, y: 250 }, gap: { x: 390, y: 250 }, off: { fillBackground: false } },
    // Levels at 100 + 300·coeff on both axes.
    { name: "gann-box", mk: (s) => dp("gann-box", 2, s), pts: [{ x: 100, y: 100 }, { x: 400, y: 400 }], line: { x: 130, y: 250 }, gap: { x: 130, y: 130 }, off: { fillBackground: false, fillVertBackground: false } },
    // Grid every 50 px from (100, 100); the gap is 9.8 px inside the (5, 0) arc.
    { name: "gann-square", mk: (s) => dp("gann-square", 2, s), pts: [{ x: 100, y: 100 }, { x: 350, y: 350 }], line: { x: 150, y: 340 }, gap: { x: 110, y: 340 }, off: { fillBackground: false } },
  ];
  for (const t of LEVELS) {
    it(`${t.name}: a line = body; a gap = background, selected or not; nothing in a gap without the fill`, () => {
      expect(hit(t.mk(), t.pts, t.line)).toEqual(BODY);
      expect(hit(t.mk(), t.pts, t.gap)).toEqual(BG);
      expect(sel(t.mk(), t.pts, t.gap)).toEqual(BG);
      expect(hit(t.mk(t.off), t.pts, t.gap)).toBeNull();
      expect(hit(t.mk(t.off), t.pts, t.line)).toEqual(BODY);
    });
  }

  it("fib retracement: a level past the anchors (1.618) is the body; past the levels' x-range nothing", () => {
    const pts = [{ x: 100, y: 250 }, { x: 300, y: 400 }];
    expect(hit(dp("fib-retracement", 2), pts, { x: 150, y: 157.3 })).toEqual(BODY);
    expect(hit(dp("fib-retracement", 2), pts, { x: 350, y: 335 })).toBeNull();
    expect(hit(dp("fib-retracement", 2, { extendRight: true }), pts, { x: 350, y: 335 })).toEqual(BG);
  });

  it("gann box: each band follows its own fill (price levels: Background, time levels: the vertical one)", () => {
    const pts = [{ x: 100, y: 100 }, { x: 400, y: 400 }];
    expect(hit(dp("gann-box", 2, { fillBackground: false }), pts, { x: 130, y: 130 })).toEqual(BG);
    expect(hit(dp("gann-box", 2, { fillVertBackground: false }), pts, { x: 130, y: 130 })).toEqual(BG);
  });

  // Box tools: [drawing, screen points, a point on a line, a point inside off the lines].
  const BOXES: { name: string; mk: (s?: Partial<DrawingStyle>) => Drawing; pts: Pt[]; line: Pt; inside: Pt; noFill: boolean }[] = [
    { name: "price-range", mk: (s) => dp("price-range", 2, s), pts: [{ x: 100, y: 100 }, { x: 300, y: 300 }], line: { x: 150, y: 100 }, inside: { x: 150, y: 200 }, noFill: true },
    { name: "date-range", mk: (s) => dp("date-range", 2, s), pts: [{ x: 100, y: 100 }, { x: 300, y: 300 }], line: { x: 100, y: 150 }, inside: { x: 150, y: 150 }, noFill: true },
    { name: "date-and-price-range", mk: (s) => dp("date-and-price-range", 2, s), pts: [{ x: 100, y: 100 }, { x: 300, y: 300 }], line: { x: 150, y: 200 }, inside: { x: 150, y: 150 }, noFill: true },
    // Entry y 250, target 210, stop 290 (no coords: ±40 px).
    { name: "long-position", mk: (s) => dp("long-position", 2, s), pts: [{ x: 100, y: 250 }, { x: 300, y: 250 }], line: { x: 200, y: 210 }, inside: { x: 200, y: 230 }, noFill: false },
  ];
  for (const t of BOXES) {
    it(`${t.name}: a line = body; the box = background, the body while selected`, () => {
      expect(hit(t.mk(), t.pts, t.line)).toEqual(BODY);
      expect(hit(t.mk(), t.pts, t.inside)).toEqual(BG);
      expect(sel(t.mk(), t.pts, t.inside)).toEqual(BODY);
      if (t.noFill) {
        expect(hit(t.mk({ fillBackground: false }), t.pts, t.inside)).toBeNull();
        expect(sel(t.mk({ fillBackground: false }), t.pts, t.inside)).toBeNull();
        expect(hit(t.mk({ fillBackground: false }), t.pts, t.line)).toEqual(BODY);
      }
    });
  }

  it("ranges: the distance line is the body, the extend flags stretch the box, the border hits only when drawn", () => {
    const pts = [{ x: 100, y: 100 }, { x: 300, y: 300 }];
    expect(hit(dp("price-range", 2), pts, { x: 200, y: 150 })).toEqual(BODY);
    expect(hit(dp("price-range", 2, { extendRight: true }), pts, { x: 600, y: 200 })).toEqual(BG);
    expect(hit(dp("date-range", 2), pts, { x: 150, y: 200 })).toEqual(BODY);
    expect(hit(dp("date-range", 2, { extendBottom: true }), pts, { x: 150, y: 450 })).toEqual(BG);
    expect(hit(dp("date-and-price-range", 2), pts, { x: 100, y: 150 })).toEqual(BG);
    expect(hit(dp("date-and-price-range", 2, { drawBorder: true }), pts, { x: 100, y: 150 })).toEqual(BODY);
  });
});

describe("pickTopmostHit", () => {
  const items = ["under-line", "under-fill", "top-fill"];
  const test = (r: Record<string, HitResult | null>) => (k: string) => r[k] ?? null;

  it("a line under a fill wins over the fill on top", () => {
    expect(pickTopmostHit(items, test({ "under-line": BODY, "top-fill": BG }))?.item).toBe("under-line");
  });
  it("among fills only, the topmost", () => {
    expect(pickTopmostHit(items, test({ "under-fill": BG, "top-fill": BG }))?.item).toBe("top-fill");
  });
  it("fills: false drops the fill hits (#31)", () => {
    expect(pickTopmostHit(items, test({ "under-fill": BG, "top-fill": BG }), { fills: false })).toBeNull();
    expect(pickTopmostHit(items, test({ "under-line": BODY, "top-fill": BG }), { fills: false })?.item).toBe("under-line");
  });
  it("among strokes, the topmost; nothing hit = null", () => {
    expect(pickTopmostHit(items, test({ "under-line": BODY, "under-fill": { hit: "handle", handleIndex: 0 } }))?.item).toBe("under-fill");
    expect(pickTopmostHit(items, test({}))).toBeNull();
  });
});

describe("DrawingManager (#30)", () => {
  /** A trend line (100, 200) → (300, 300) under a filled rectangle (50, 150) → (350, 350). */
  function scene(fill = true) {
    const s = setup();
    const line = s.dm.add({ kind: "trend-line", points: [{ time: 100 as never, price: 300 }, { time: 300 as never, price: 200 }] });
    const rect = s.dm.add({
      kind: "rectangle",
      points: [{ time: 50 as never, price: 350 }, { time: 350 as never, price: 150 }],
      style: { ...defaultStyleFor("rectangle"), fillBackground: fill },
    });
    return { s, line, rect };
  }
  const click = (s: ReturnType<typeof setup>, x: number, y: number) => {
    s.el.dispatchEvent(ptr("pointerdown", "mouse", x, y));
    s.win.dispatchEvent(ptr("pointerup", "mouse", x, y));
  };

  it("a click on the line inside the rectangle on top selects the line", () => {
    const { s, line } = scene();
    click(s, 200, 250);
    expect(s.dm.selection()).toEqual([line]);
  });
  it("a mouse press on the rectangle's fill passes through: no selection, the chart keeps the drag (#31)", () => {
    const { s } = scene();
    const down = ptr("pointerdown", "mouse", 100, 300);
    const stop = vi.spyOn(down, "stopPropagation");
    s.el.dispatchEvent(down);
    s.win.dispatchEvent(ptr("pointerup", "mouse", 100, 300));
    expect(stop).not.toHaveBeenCalled();
    expect(s.chart.applyOptions).not.toHaveBeenCalled();
    expect(s.dm.selection()).toEqual([]);
  });
  it("a selected rectangle takes a mouse press on its fill: it stays selected and the gesture is its drag (#32)", () => {
    const { s, rect } = scene();
    s.el.dispatchEvent(ptr("pointerdown", "mouse", 150, 350));
    s.doc.dispatchEvent(ptr("pointerup", "mouse", 150, 350));
    expect(s.dm.selection()).toEqual([rect]);
    s.chart.applyOptions.mockClear();
    const down = ptr("pointerdown", "mouse", 100, 300);
    const stop = vi.spyOn(down, "stopPropagation");
    s.el.dispatchEvent(down);
    expect(stop).toHaveBeenCalled();
    expect(s.chart.applyOptions.mock.calls).toEqual([[OFF]]);
    s.doc.dispatchEvent(ptr("pointerup", "mouse", 100, 300));
    expect(s.dm.selection()).toEqual([rect]);
  });
  it("a touch on the rectangle's fill selects it (#31)", () => {
    const { s, rect } = scene();
    s.el.dispatchEvent(ptr("pointerdown", "touch", 100, 300));
    s.doc.dispatchEvent(ptr("pointerup", "touch", 100, 300));
    s.win.dispatchEvent(ptr("pointerup", "touch", 100, 300));
    expect(s.dm.selection()).toEqual([rect]);
  });
  it("without the fill, the interior passes through; the border still selects", () => {
    const { s, rect } = scene(false);
    click(s, 100, 300);
    expect(s.dm.selection()).toEqual([]);
    click(s, 150, 350);
    expect(s.dm.selection()).toEqual([rect]);
  });
});

describe("DrawingManager: fib retracement (#40)", () => {
  /** A trend line (120, 323) → (180, 383) under a fib retracement (100, 250) → (300, 400):
   *  levels at y = 400 − 150·coeff (0.5 → 325, 0.382 → 342.7, 0.236 → 364.6). */
  function scene() {
    const s = setup();
    const line = s.dm.add({ kind: "trend-line", points: [{ time: 120 as never, price: 177 }, { time: 180 as never, price: 117 }] });
    const fib = s.dm.add({ kind: "fib-retracement", points: [{ time: 100 as never, price: 250 }, { time: 300 as never, price: 100 }] });
    return { s, line, fib };
  }
  const pressPasses = (s: ReturnType<typeof setup>, type: string, x: number, y: number) => {
    const down = ptr("pointerdown", type, x, y);
    const stop = vi.spyOn(down, "stopPropagation");
    s.el.dispatchEvent(down);
    s.doc.dispatchEvent(ptr("pointerup", type, x, y));
    s.win.dispatchEvent(ptr("pointerup", type, x, y));
    return !stop.mock.calls.length;
  };

  it("a mouse press between two levels passes through to the chart, selected or not", () => {
    const { s, fib } = scene();
    expect(pressPasses(s, "mouse", 250, 335)).toBe(true);
    expect(s.dm.selection()).toEqual([]);
    s.dm.select([fib]);
    s.chart.applyOptions.mockClear();
    expect(pressPasses(s, "mouse", 250, 335)).toBe(true);
    expect(s.chart.applyOptions).not.toHaveBeenCalled();
  });
  it("a mouse press on a level selects the fib", () => {
    const { s, fib } = scene();
    expect(pressPasses(s, "mouse", 250, 325)).toBe(false);
    expect(s.dm.selection()).toEqual([fib]);
  });
  it("the trend line under the fib wins over the fib's fill", () => {
    const { s, line } = scene();
    expect(pressPasses(s, "mouse", 150, 353)).toBe(false);
    expect(s.dm.selection()).toEqual([line]);
  });
  it("a touch between two levels selects the fib (touch keeps the fill)", () => {
    const { s, fib } = scene();
    pressPasses(s, "touch", 250, 335);
    expect(s.dm.selection()).toEqual([fib]);
  });
});
