/*
 * Calendar parts of an epoch-seconds bar time in a time zone (moved from
 * OpenTrader chart/time-format). One cached Intl formatter per time zone.
 */

export type Parts = { y: number; m: number; d: number; wd: string; hh: string; mi: string; ss: string };

const partsFmt = new Map<string, Intl.DateTimeFormat>();

export function partsOf(sec: number, timeZone: string): Parts {
  let f = partsFmt.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone, year: "numeric", month: "numeric", day: "numeric", weekday: "short",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    });
    partsFmt.set(timeZone, f);
  }
  const p = f.formatToParts(new Date(sec * 1000));
  const g = (k: string) => p.find((x) => x.type === k)?.value ?? "";
  return { y: Number(g("year")), m: Number(g("month")), d: Number(g("day")), wd: g("weekday"), hh: g("hour"), mi: g("minute"), ss: g("second") };
}

const pad = (n: number, w: number) => String(n).padStart(w, "0");

/** Date "yyyy-MM-dd" and time "HH:mm" of a bar time in `timeZone` (TV
 *  DateFormatter / TimeFormatter defaults, used by the Position forecast). */
export function isoDateTimeParts(sec: number, timeZone: string): { date: string; time: string } {
  const p = partsOf(sec, timeZone);
  return { date: `${pad(p.y, 4)}-${pad(p.m, 2)}-${pad(p.d, 2)}`, time: `${p.hh}:${p.mi}` };
}
