/**
 * The numbers the drawings write without a host number format (#29): the
 * library's English text, pinned drawing by drawing (snapshots taken before
 * the number format was added).
 */
import { describe, expect, it } from "vitest";
import { CASES, textsOf } from "./number-cases";

describe("drawing numbers without a number format (English)", () => {
  it.each(CASES)("%s", (_, d) => {
    expect(textsOf(d)).toMatchSnapshot();
  });
});
