/**
 * Placement preview of the pattern and Elliott tools: the real tool over the points placed so far
 * plus the cursor, so the fills, ratios and labels of the legs that already exist show while the
 * next vertex is being aimed (TV draws the X-A-B triangle and its ratio before B is clicked).
 * The cursor is not repeated to fill the missing vertices: duplicated points would draw zero legs.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ptr, setup } from "./pointer-harness";

type S = ReturnType<typeof setup>;
type Item = { t: string; text?: string; items?: Item[] };
const preview = (s: S): Item[] =>
  ((s.dm as unknown as { previewScene(w: number, h: number): Item[] | null }).previewScene(800, 500) ?? []);
const flat = (items: Item[]): Item[] => items.flatMap((i) => [i, ...flat(i.items ?? [])]);
const texts = (s: S): string[] => flat(preview(s)).filter((i) => i.t === "text").map((i) => i.text ?? "");
const polygons = (s: S): number => flat(preview(s)).filter((i) => i.t === "polygon").length;
const place = (s: S, x: number, y: number) => {
  s.el.dispatchEvent(ptr("pointerdown", "mouse", x, y));
  s.win.dispatchEvent(ptr("pointerup", "mouse", x, y));
};
const hover = (s: S, x: number, y: number) => s.el.dispatchEvent(ptr("pointermove", "mouse", x, y));
/** Setup whose document can measure caption pills (no canvas: the width falls back to a per-char estimate). */
const setupWithText = (opts: Parameters<typeof setup>[0] = {}): S => {
  const s = setup(opts);
  (s.doc as unknown as { createElement: () => unknown }).createElement = () => ({ getContext: () => null });
  return s;
};

describe("pattern placement preview", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("XABCD: after X and A the cursor closes the X-A-B triangle with its fill and the XB ratio", () => {
    const s = setup();
    s.dm.setTool("xabcd-pattern");
    place(s, 100, 400); // X, price 100
    place(s, 200, 100); // A, price 400
    hover(s, 300, 300); // B at price 200: |AB / XA| = 200 / 300
    expect(polygons(s)).toBe(1);
    expect(texts(s)).toContain("0.667");
    expect(texts(s)).toEqual(expect.arrayContaining(["X", "A", "B"]));
  });

  it("a cursor standing on the last vertex adds no zero leg (no ∞)", () => {
    const s = setup();
    s.dm.setTool("xabcd-pattern");
    place(s, 100, 400);
    place(s, 200, 100);
    place(s, 300, 300);
    hover(s, 300, 300);
    expect(texts(s).some((t) => t.includes("∞"))).toBe(false);
    expect(texts(s)).toContain("0.667");
  });

  it("ABCD and three drives show the ratio of each leg that already has its points", () => {
    const abcd = setup();
    abcd.dm.setTool("abcd-pattern");
    place(abcd, 100, 400);
    place(abcd, 200, 100);
    hover(abcd, 300, 300);
    expect(texts(abcd)).toContain("0.667");

    const drives = setup();
    drives.dm.setTool("three-drives-pattern");
    place(drives, 100, 450);
    place(drives, 150, 300);
    place(drives, 200, 400);
    hover(drives, 250, 150);
    expect(texts(drives)).toContain("2.5");
  });

  it("Elliott impulse: the wave labels of the placed points and the cursor", () => {
    const s = setup();
    s.dm.setTool("elliott-impulse");
    place(s, 100, 400);
    place(s, 200, 200);
    hover(s, 300, 300);
    expect(texts(s).length).toBe(2); // (1) and (2); (0) shows only while selected
  });

  it("one placed point: the first leg with its letters, no fill and no ratio yet", () => {
    const s = setup();
    s.dm.setTool("xabcd-pattern");
    place(s, 100, 400);
    hover(s, 200, 100);
    expect(polygons(s)).toBe(0);
    expect(texts(s)).toEqual(expect.arrayContaining(["X", "A"]));
  });

  it("head and shoulders before its 7th point: the finished drawing's caption words, never the LS / H / RS shorthand", () => {
    const s = setupWithText();
    s.dm.setTool("head-and-shoulders");
    for (const [x, y] of [[100, 400], [150, 250], [200, 350], [250, 150]]) place(s, x, y);
    hover(s, 300, 350);
    expect(texts(s)).toEqual(expect.arrayContaining(["Left Shoulder", "Head"]));
    expect(texts(s).filter((t) => ["LS", "H", "RS"].includes(t))).toEqual([]);
  });

  it("head and shoulders preview captions go through the host labels hook (a translated site)", () => {
    const s = setupWithText({
      formatLabel: (l) => (l.kind === "head-and-shoulders" && l.id === "caption" ? `<${l.text}>` : undefined),
    });
    s.dm.setTool("head-and-shoulders");
    for (const [x, y] of [[100, 400], [150, 250], [200, 350], [250, 150]]) place(s, x, y);
    hover(s, 300, 350);
    expect(texts(s)).toEqual(expect.arrayContaining(["<Left Shoulder>", "<Head>"]));
  });

  it("head and shoulders and the triangle pattern preview without errors before their full count", () => {
    for (const kind of ["head-and-shoulders", "triangle-pattern"] as const) {
      const s = setupWithText();
      s.dm.setTool(kind);
      place(s, 100, 400);
      place(s, 150, 200);
      hover(s, 200, 350);
      expect(preview(s).length).toBeGreaterThan(0);
    }
  });

  it("the finished drawing is unchanged: N clicks still store N points", () => {
    const s = setup();
    s.dm.setTool("xabcd-pattern");
    for (const [x, y] of [[100, 400], [200, 100], [300, 300], [400, 150], [500, 350]]) {
      hover(s, x, y);
      place(s, x, y);
    }
    expect(s.dm.drawings().map((d) => [d.kind, d.points.length])).toEqual([["xabcd-pattern", 5]]);
  });
});
