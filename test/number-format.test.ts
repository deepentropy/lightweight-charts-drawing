/**
 * Host number format (#29): `setNumberFormat` writes every number the drawings
 * draw; `setNumberFormat(undefined)` restores the English text.
 */
import { afterEach, describe, expect, it } from "vitest";
import { ENGLISH_NUMBER_FORMAT, getNumberFormat, setNumberFormat, type NumberFormat } from "lightweight-charts-drawing";
import { CASES, textsOf } from "./number-cases";

/** "1 234,56" (narrow no-break spaces), "−5,81%", "103,47 M". */
const NNBSP = " ";
function frNumber(v: number, digits: number): string {
  const [int, dec] = Math.abs(v).toFixed(digits).split(".");
  const t = int.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP) + (dec ? `,${dec}` : "");
  return v < 0 ? `−${t}` : t;
}
const FRENCH: NumberFormat = {
  formatNumber: (v, digits) => frNumber(v, digits),
  formatPercent: (v, digits) => `${frNumber(v, digits)}%`,
  formatVolume: (v) => ENGLISH_NUMBER_FORMAT.formatVolume(v).replace(".", ","),
};

const texts = (name: string) => textsOf(CASES.find(([n]) => n === name)![1]);

describe("setNumberFormat", () => {
  afterEach(() => setNumberFormat(undefined));

  it("writes the ruler numbers: change, percent, pips, bars, days, distance, angle", () => {
    setNumberFormat(FRENCH);
    expect(texts("trend line, falling, 1,500 days")).toEqual([
      "−266,25 (−17,74%), −26 625",
      "1 500 bars (1 500d), distance: 15 005 px",
      "−1,53º",
    ]);
    expect(texts("trend line, right to left")).toEqual(["50,00 (4,00%), 5 000", "−20 bars (−20d), distance: 214 px", "159,44º"]);
    expect(texts("trend angle")).toEqual(["26,57º"]);
  });

  it("writes the range volume with the host's volume format", () => {
    setNumberFormat(FRENCH);
    expect(texts("date and price range")).toEqual(["115,75 (9,57%) 11 575", "38 bars, 38d", "Vol 1,96 B"]);
  });

  it("writes the position labels", () => {
    setNumberFormat(FRENCH);
    expect(texts("long position")).toEqual([
      "Target: 150 000,00 (12 000,000%) 15 000 000, Amount: 25 193,55",
      "Open PnL: 40,50, Qty: 0",
      "Risk/reward ratio: 96,77",
      "Stop: 1 550,00 (124,000%) 155 000, Amount: 750",
    ]);
    expect(texts("short position, compact")).toEqual([
      "3 000,00 (240,000%) 300 000 1 483,87",
      "−40,50 ~ 0",
      "1,94",
      "1 550,00 (124,000%) 155 000 750",
    ]);
    expect(texts("position forecast")).toEqual(["1 250,00", "2020-01-16", "−19,50 (−1,56%) in 30d", "1 230,50", "2020-02-15", "FAILURE"]);
  });

  it("writes prices, coefficients and ratios", () => {
    setNumberFormat(FRENCH);
    expect(texts("price note")).toEqual(["1 234,50"]);
    expect(texts("price label")).toEqual(["1 234,50"]);
    expect(texts("disjoint channel with prices")).toEqual(["1 200,00", "1 250,00", "1 300,00", "1 350,00"]);
    expect(texts("fib retracement").slice(0, 2)).toEqual(["0 (1 350,00)", "0,236 (1 314,60)"]);
    expect(texts("fib retracement in percents").slice(1, 2)).toEqual(["23,60% (1 314,60)"]);
    expect(texts("fib channel").slice(1, 2)).toEqual(["0,236 (1 223,60)"]);
    expect(texts("gann box").slice(2, 6)).toEqual(["0,25", "0,25", "0,382", "0,382"]);
    expect(texts("gann square")).toEqual(["150,00", "25", "6"]);
    expect(texts("abcd pattern").slice(0, 2)).toEqual(["0,6", "1,5"]);
  });

  it("restores the English text", () => {
    setNumberFormat(FRENCH);
    expect(getNumberFormat()).toBe(FRENCH);
    setNumberFormat(undefined);
    expect(getNumberFormat()).toBeUndefined();
    expect(texts("trend line, falling, 1,500 days")).toEqual([
      "−266.25 (−17.74%), −26625",
      "1500 bars (1,500d), distance: 15005 px",
      "-1.53º",
    ]);
  });

  it("ENGLISH_NUMBER_FORMAT as the host format writes the library's numbers", () => {
    setNumberFormat(ENGLISH_NUMBER_FORMAT);
    expect(texts("price note")).toEqual(["1234.50"]);
    expect(texts("date and price range")).toEqual(["115.75 (9.57%) 11575", "38 bars, 38d", "Vol 1.96 B"]);
    expect(texts("long position")[0]).toBe("Target: 150,000.00 (12000.000%) 15,000,000, Amount: 25193.55");
  });
});
