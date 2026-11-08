// magnetSource: the host supplies the magnet candidates (bar time + prices) for the cursor's time, instead of the
// series OHLC. null / empty / throwing source = no snap; the snapped price is the candidate exactly.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DrawingManagerOptions } from "../src";
import { ev, ptr, setup } from "./pointer-harness";

afterEach(() => vi.unstubAllGlobals());

/** y = 500 - price, x = time. Place one horizontal line with a press at (x = 100, price) and return its point. */
function place(opts: DrawingManagerOptions, price: number, pre?: (s: ReturnType<typeof setup>) => void) {
  const s = setup(opts);
  pre?.(s);
  s.dm.setTool("horizontal-line");
  s.el.dispatchEvent(ptr("pointerdown", "mouse", 100, 500 - price));
  s.win.dispatchEvent(ptr("pointerup", "mouse", 100, 500 - price));
  return s.dm.drawings()[0]?.points[0];
}

const VALUES = [100, 120, 90, 110];
const src = (values: readonly number[] = VALUES) => vi.fn((_t: unknown) => ({ time: 77 as never, values }));

describe("option omitted (0.6.3 pinned)", () => {
  it("weak: a point near a candle high snaps to that high on the bar time", () => {
    const bars = () => [50, 100, 150].map((time) => ({ time: time as never, open: 100, high: 120, low: 90, close: 110 }));
    expect(place({ magnet: "weak", bars }, 130)).toEqual({ time: 100, price: 120 });
  });
});

describe("magnetSource", () => {
  it("weak, 10 px from a value: exact candidate price on the returned bar time; the source gets the cursor time", () => {
    const f = src();
    expect(place({ magnet: "weak", magnetSource: f }, 130)).toEqual({ time: 77, price: 120 });
    expect(f).toHaveBeenCalledWith(100);
  });

  it("weak, 80 px from every value: placed as is", () => {
    expect(place({ magnet: "weak", magnetSource: src() }, 200)).toEqual({ time: 100, price: 200 });
  });

  it("strong: the nearest value always", () => {
    expect(place({ magnet: "strong", magnetSource: src() }, 200)).toEqual({ time: 77, price: 120 });
  });

  it("Ctrl inverts off to strong", () => {
    const p = place({ magnet: "off", magnetSource: src() }, 200, (s) => s.win.dispatchEvent(ev("keydown", { key: "Control" })));
    expect(p).toEqual({ time: 77, price: 120 });
  });

  it("the price is not rounded", () => {
    expect(place({ magnet: "strong", magnetSource: src([100.123456789, 300]) }, 90)).toEqual({ time: 77, price: 100.123456789 });
  });

  it.each(["weak", "strong"] as const)("%s: null, an empty list, a throwing source and NaN-only values place the point as is", (magnet) => {
    const as = { time: 100, price: 150 };
    expect(place({ magnet, magnetSource: () => null }, 150)).toEqual(as);
    expect(place({ magnet, magnetSource: () => ({ time: 77 as never, values: [] }) }, 150)).toEqual(as);
    expect(place({ magnet, magnetSource: () => { throw new Error("host bug"); } }, 150)).toEqual(as);
    expect(place({ magnet, magnetSource: src([NaN, Infinity]) }, 150)).toEqual(as);
  });

  it("non-finite candidates are skipped", () => {
    expect(place({ magnet: "strong", magnetSource: src([NaN, 120]) }, 200)).toEqual({ time: 77, price: 120 });
  });

  it("magnet off: the source is never called", () => {
    const f = src();
    expect(place({ magnet: "off", magnetSource: f }, 130)).toEqual({ time: 100, price: 130 });
    expect(f).not.toHaveBeenCalled();
  });
});
