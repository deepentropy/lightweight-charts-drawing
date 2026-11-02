/*
 * Example: a Fibonacci retracement over the swing of a bar range, with a reduced level set.
 * Checked in CI (test/skill-examples.test.ts and `npm run typecheck`).
 */
import { defaultStyleFor, type DataPoint, type NewDrawing, type OHLC } from "lightweight-charts-drawing";

/** The levels kept visible; the other levels of the factory ladder stay in the style, hidden. */
export const SHOWN_LEVELS = [0, 0.382, 0.5, 0.618, 1];

/**
 * Retracement of the move between the lowest low and the highest high of bars[from..to].
 * The first point is the swing start and the second the swing end: level 0 sits on the second
 * point and level 1 on the first, so on an up move 0.618 = high - 0.618 * (high - low).
 */
export function swingRetracement(bars: readonly OHLC[], from: number, to: number): NewDrawing {
  let lo = from;
  let hi = from;
  for (let i = from; i <= to; i++) {
    if (bars[i].low < bars[lo].low) lo = i;
    if (bars[i].high > bars[hi].high) hi = i;
  }
  const low: DataPoint = { time: bars[lo].time, price: bars[lo].low };
  const high: DataPoint = { time: bars[hi].time, price: bars[hi].high };
  const points: [DataPoint, DataPoint] = lo <= hi ? [low, high] : [high, low];
  // defaultStyleFor returns a fresh copy of the level ladder: edit it freely.
  const style = defaultStyleFor("fib-retracement");
  const levels = (style.levels ?? []).map((l) => ({ ...l, visible: SHOWN_LEVELS.includes(l.coeff) }));
  return {
    kind: "fib-retracement",
    points,
    style: { ...style, levels, extendRight: true, fibLevelsAsPercents: true },
  };
}

/** Price of a level, as the tool draws it on a linear price scale with `reverse` off. */
export function fibLevelPrice(points: readonly DataPoint[], coeff: number): number {
  const [p0, p1] = points;
  return p1.price + coeff * (p0.price - p1.price);
}
