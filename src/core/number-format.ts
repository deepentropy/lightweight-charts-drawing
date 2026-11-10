/*
 * Locale-aware number text for the numbers the library draws itself.
 *
 * Every call site passes the exact string it built before (`fallback`): with
 * no `numberLocale` the helper returns it untouched, so the default output
 * stays byte-identical to the fixed EN text and the library never reads the
 * browser locale. `Intl.NumberFormat` is used only when a locale is set.
 */
import type { Coords } from "./coords";

/** Formatters by `locale|min|max`; `null` marks a locale `Intl` rejected. */
const formatters = new Map<string, Intl.NumberFormat | null>();

/** `value` as text in `coords.numberLocale` with `digits` fraction digits;
 *  `fallback` when no locale is set, the value is not finite, or the locale
 *  tag is invalid (a bad host value must never break painting). */
export function formatNumber(
  coords: Pick<Coords, "numberLocale"> | null | undefined,
  value: number,
  digits: { min: number; max: number },
  fallback: string,
): string {
  const locale = coords?.numberLocale;
  if (!locale || !Number.isFinite(value)) return fallback;
  const key = `${locale}|${digits.min}|${digits.max}`;
  let nf = formatters.get(key);
  if (nf === undefined) {
    try {
      nf = new Intl.NumberFormat(locale, { minimumFractionDigits: digits.min, maximumFractionDigits: digits.max });
    } catch {
      nf = null;
    }
    formatters.set(key, nf);
  }
  if (!nf) return fallback;
  // Pre-round like `toFixed` (what the EN fallbacks use) so a tie rounds the
  // same in every locale; `|| 0` turns a rounded -0 into 0 (no "-0").
  return nf.format(Number(value.toFixed(digits.max)) || 0);
}
