// touchHitSlop: widens handle / stroke hit testing for touch and pen only; mouse stays at 0.10.1 radii.
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultStyleFor } from "../src";
import { withTouchHitSlop } from "../src/core/_shared";
import { OFF, ptr, setup, withSelectedLine } from "./pointer-harness";

afterEach(() => vi.unstubAllGlobals());

const P1 = { x: 100, y: 200 };

function held(s: ReturnType<typeof setup>): boolean {
  return s.chart.applyOptions.mock.calls.some((c) => JSON.stringify(c[0]) === JSON.stringify(OFF));
}

function pressDrag(
  s: ReturnType<typeof setup>,
  pointerType: string,
  x: number,
  y: number,
  dx = 30,
  dy = 0,
): boolean {
  s.el.dispatchEvent(ptr("pointerdown", pointerType, x, y));
  if (!held(s)) return false;
  s.doc.dispatchEvent(ptr("pointermove", pointerType, x + dx, y + dy));
  s.doc.dispatchEvent(ptr("pointerup", pointerType, x + dx, y + dy));
  return true;
}

function pressHit(s: ReturnType<typeof setup>, pointerType: string, x: number, y: number): boolean {
  s.el.dispatchEvent(ptr("pointerdown", pointerType, x, y));
  const ok = held(s);
  if (ok) s.doc.dispatchEvent(ptr("pointerup", pointerType, x, y));
  return ok;
}

/** Text layout measures on a canvas; the pointer harness document has none. */
function stubTextMeasure(s: ReturnType<typeof setup>): void {
  (s.doc as unknown as { createElement: () => { getContext: () => null } }).createElement = () => ({
    getContext: () => null,
  });
}

describe("touchHitSlop: 16", () => {
  it("TOUCH press 26 px from point 1 grabs the handle; 29 px does not", () => {
    const near = setup({ touchHitSlop: 16 });
    const nearId = withSelectedLine(near);
    const before = near.dm.get(nearId)!.points[0];
    expect(pressDrag(near, "touch", P1.x - 26, P1.y)).toBe(true);
    const after = near.dm.get(nearId)!.points[0];
    expect(after.time !== before.time || after.price !== before.price).toBe(true);

    const far = setup({ touchHitSlop: 16 });
    withSelectedLine(far);
    expect(pressDrag(far, "touch", P1.x - 29, P1.y)).toBe(false);
    expect(far.dm.selection()).toEqual([]);
  });

  it("MOUSE press 13 px from the handle does not grab it (mouse ignores the slop)", () => {
    const s = setup({ touchHitSlop: 16 });
    withSelectedLine(s);
    expect(pressDrag(s, "mouse", P1.x - 13, P1.y)).toBe(false);
    expect(s.dm.selection()).toEqual([]);
  });

  it("TOUCH: 20 px off a Horizontal line hits it", () => {
    const s = setup({ touchHitSlop: 16 });
    const id = s.dm.add({ kind: "horizontal-line", points: [{ time: 100 as never, price: 300 }] });
    s.dm.select([id]);
    // Line at y=200; 20 px above.
    expect(pressHit(s, "touch", 400, 180)).toBe(true);
  });

  it("TOUCH: 20 px outside a Rectangle border hits the border", () => {
    const s = setup({ touchHitSlop: 16 });
    const id = s.dm.add({
      kind: "rectangle",
      points: [{ time: 100 as never, price: 400 }, { time: 300 as never, price: 200 }],
      style: { ...defaultStyleFor("rectangle"), fillBackground: false },
    });
    s.dm.select([id]);
    // Top border at y=100; 20 px above the midpoint of the top edge.
    expect(pressHit(s, "touch", 200, 80)).toBe(true);
  });

  it("TOUCH: 26 px from a Brush end handle grabs it", () => {
    const s = setup({ touchHitSlop: 16 });
    const id = s.dm.add({
      kind: "brush",
      points: [
        { time: 100 as never, price: 300 },
        { time: 150 as never, price: 280 },
        { time: 200 as never, price: 250 },
      ],
    });
    s.dm.select([id]);
    const before = s.dm.get(id)!.points[2]!;
    // End handle at (200, 250); press 26 px left (off the stroke).
    expect(pressDrag(s, "touch", 200 - 26, 250)).toBe(true);
    const after = s.dm.get(id)!.points[2]!;
    expect(after.time !== before.time || after.price !== before.price).toBe(true);
  });

  it("TOUCH: 20 px off a selected Text box hits it", () => {
    const s = setup({ touchHitSlop: 16 });
    stubTextMeasure(s);
    const id = s.dm.add({ kind: "text", points: [{ time: 400 as never, price: 250 }], text: "Hello" });
    s.dm.select([id]);
    // Text box top-left is at the point (400, 250); 20 px left is outside.
    expect(pressHit(s, "touch", 380, 250)).toBe(true);
  });

  it("PEN uses the same slop as TOUCH", () => {
    const s = setup({ touchHitSlop: 16 });
    withSelectedLine(s);
    expect(pressDrag(s, "pen", P1.x - 26, P1.y)).toBe(true);
  });

  it("0.10 fill rule: a pen tap inside an unselected filled Rectangle passes through; a touch tap selects it", () => {
    // Asserts the selection after a full tap, not the press-time hold, so it holds whether or not a
    // touch press on an unselected drawing holds the chart.
    const filled = () => {
      const s = setup({ touchHitSlop: 16 });
      const id = s.dm.add({
        kind: "rectangle",
        points: [{ time: 50 as never, price: 350 }, { time: 350 as never, price: 150 }],
        style: { ...defaultStyleFor("rectangle"), fillBackground: true },
      });
      return { s, id };
    };
    const tap = (s: ReturnType<typeof setup>, pointerType: string, x: number, y: number) => {
      s.el.dispatchEvent(ptr("pointerdown", pointerType, x, y));
      s.doc.dispatchEvent(ptr("pointerup", pointerType, x, y));
    };
    const pen = filled();
    tap(pen.s, "pen", 100, 300);
    expect(pen.s.dm.selection()).toEqual([]);

    const touch = filled();
    tap(touch.s, "touch", 100, 300);
    expect(touch.s.dm.selection()).toEqual([touch.id]);
  });

  it("MOUSE with touchHitSlop: 16 misses the widened touch targets", () => {
    const horiz = setup({ touchHitSlop: 16 });
    const hid = horiz.dm.add({ kind: "horizontal-line", points: [{ time: 100 as never, price: 300 }] });
    horiz.dm.select([hid]);
    expect(pressHit(horiz, "mouse", 400, 180)).toBe(false);

    const rect = setup({ touchHitSlop: 16 });
    const rid = rect.dm.add({
      kind: "rectangle",
      points: [{ time: 100 as never, price: 400 }, { time: 300 as never, price: 200 }],
      style: { ...defaultStyleFor("rectangle"), fillBackground: false },
    });
    rect.dm.select([rid]);
    expect(pressHit(rect, "mouse", 200, 80)).toBe(false);

    const brush = setup({ touchHitSlop: 16 });
    const bid = brush.dm.add({
      kind: "brush",
      points: [
        { time: 100 as never, price: 300 },
        { time: 150 as never, price: 280 },
        { time: 200 as never, price: 250 },
      ],
    });
    brush.dm.select([bid]);
    expect(pressDrag(brush, "mouse", 200 - 26, 250)).toBe(false);

    const text = setup({ touchHitSlop: 16 });
    stubTextMeasure(text);
    const tid = text.dm.add({ kind: "text", points: [{ time: 400 as never, price: 250 }], text: "Hello" });
    text.dm.select([tid]);
    expect(pressHit(text, "mouse", 380, 250)).toBe(false);
  });

  it("slop scope restores after a throw inside a hit test (later mouse hit uses 0.10.1 radii)", () => {
    expect(() =>
      withTouchHitSlop(16, () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    const s = setup({ touchHitSlop: 16 });
    withSelectedLine(s);
    // Mouse at 13 px must still miss after the thrown scope.
    expect(pressDrag(s, "mouse", P1.x - 13, P1.y)).toBe(false);
  });
});
