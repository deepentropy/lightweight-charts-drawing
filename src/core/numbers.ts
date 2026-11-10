/*
 * Number text of the drawings (#29): every number written on the canvas goes
 * through one host format (`setNumberFormat`), else the library's own English
 * text, unchanged ("1234.56", "1,234.56", "−5.81%", "103.47 M", "0.618").
 * Renderer-neutral: scene builders call these where the text is built,
 * before it is measured.
 */

/** A host number format ("1 234,56", "−5,81%", "103,47 M"). */
export type NumberFormat = {
  /** `value` with `digits` decimals, negative values with the format's minus
   *  sign. `grouped`: the library's English text groups thousands here
   *  ("1,234.50" in a position label; a ruler writes "1234.50"). */
  formatNumber(value: number, digits: number, grouped: boolean): string;
  /** A percentage, `value` already × 100 (5.814, 2 → "5.81%"). */
  formatPercent(value: number, digits: number): string;
  /** A volume, abbreviated ("519.06 K", "1.5 M", "830"). */
  formatVolume(value: number): string;
};

let host: NumberFormat | undefined;

/** Sets the number format of every drawing label; `undefined` restores the
 *  library's English text. Global: repaint the managers after a change
 *  (`DrawingManager.redraw()`). */
export function setNumberFormat(format: NumberFormat | undefined): void {
  host = format;
}

/** The host number format, if any. */
export function getNumberFormat(): NumberFormat | undefined {
  return host;
}

const MINUS = "−";

/** English with the minus sign U+2212: "−1234.50", grouped "−1,234.50". */
function englishNumber(value: number, digits: number, grouped: boolean): string {
  const a = Math.abs(value);
  const t = grouped ? a.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : a.toFixed(digits);
  return value < 0 ? `${MINUS}${t}` : t;
}

/** Volume with a narrow no-break space (U+202F) before the unit, up to 2
 *  decimals: "519.06 K", "1.5 M", "2 B", below 1,000 the whole number. */
function englishVolume(v: number): string {
  const units: [number, string][] = [[1e9, " B"], [1e6, " M"], [1e3, " K"]];
  for (const [div, u] of units) if (Math.abs(v) >= div) return `${Number((v / div).toFixed(2))}${u}`;
  return String(Math.round(v));
}

/** The library's English format, for a host that changes only part of it. */
export const ENGLISH_NUMBER_FORMAT: NumberFormat = {
  formatNumber: englishNumber,
  formatPercent: (value, digits) => `${englishNumber(value, digits, false)}%`,
  formatVolume: englishVolume,
};

/** `v.toFixed(digits)` (a price: "1234.50", "-0.25"). */
export function fixedText(v: number, digits: number): string {
  return host ? host.formatNumber(v, digits, false) : v.toFixed(digits);
}

/** Minus U+2212, no grouping (a change: "−12.50"). */
export function signedText(v: number, digits: number): string {
  return host ? host.formatNumber(v, digits, false) : englishNumber(v, digits, false);
}

/** Thousands grouped, minus U+2212 ("−1,234.50"). */
export function groupedText(v: number, digits: number): string {
  return host ? host.formatNumber(v, digits, true) : englishNumber(v, digits, true);
}

/** A percentage with its sign: "−5.81%" (`signed`, minus U+2212) or "5.810%"
 *  (`toFixed`). */
export function percentText(v: number, digits: number, signed = true): string {
  if (host) return host.formatPercent(v, digits);
  return `${signed ? englishNumber(v, digits, false) : v.toFixed(digits)}%`;
}

/** An abbreviated volume ("519.06 K"); `english` = the library's text where it
 *  differs (the volume profile's compact "1.25M"). */
export function volumeText(v: number, english?: (v: number) => string): string {
  if (host) return host.formatVolume(v);
  return english ? english(v) : englishVolume(v);
}

/** A number written as short as it is ("0.618", "1500", "-59.04", a bar
 *  count): `english` (default `String(v)`) without a format, else the host
 *  number with as many decimals as `english` has. */
export function shortText(v: number, english: string = String(v)): string {
  if (!host || !Number.isFinite(v) || /e/i.test(english)) return english;
  const dot = english.indexOf(".");
  return host.formatNumber(v, dot < 0 ? 0 : english.length - dot - 1, false);
}
