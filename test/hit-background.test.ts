// #30: a filled area hits only while its fill is drawn, and its fill ranks below the strokes,
// handles and text of every drawing (TV background hits), so a filled shape on top never hides
// the lines under it. The outline still hits with the fill off.
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultStyleFor, hitTestKind, pickTopmostHit, type Drawing, type DrawingStyle, type HitResult, type Pt } from "../src";
import { ptr, setup } from "./pointer-harness";

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

describe("pickTopmostHit", () => {
  const items = ["under-line", "under-fill", "top-fill"];
  const test = (r: Record<string, HitResult | null>) => (k: string) => r[k] ?? null;

  it("a line under a fill wins over the fill on top", () => {
    expect(pickTopmostHit(items, test({ "under-line": BODY, "top-fill": BG }))?.item).toBe("under-line");
  });
  it("among fills only, the topmost", () => {
    expect(pickTopmostHit(items, test({ "under-fill": BG, "top-fill": BG }))?.item).toBe("top-fill");
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
  it("a click on the rectangle's fill off the line selects the rectangle", () => {
    const { s, rect } = scene();
    click(s, 100, 300);
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
