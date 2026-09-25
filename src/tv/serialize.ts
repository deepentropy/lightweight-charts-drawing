/*
 * Saved drawings: schema check and point-model migration (moved from
 * OpenTrader persistence.ts, port phase 3). Storage stays with the host.
 */
import { DEFAULT_STYLE, type Drawing } from "./types";
import { PARALLEL_CHANNEL_LEVEL_DEFAULTS } from "./specs";

/** Saved drawings (parsed JSON) -> the entries that match the current
 *  schema: id + kind + a points array of DataPoints, style backfilled, point
 *  models migrated (migrateDrawing). Anything else is dropped: e.g. pre-5c
 *  horizontal-line entries (`{price}` instead of `{points}`) — losing one or
 *  two test lines is the cost of avoiding a complicated migrator. */
export function parseDrawings(parsed: unknown): Drawing[] {
  if (!Array.isArray(parsed)) return [];
  const valid: Drawing[] = [];
  for (const d of parsed) {
    if (!d || typeof d !== "object") continue;
    if (typeof d.id !== "string" || typeof d.kind !== "string") continue;
    if (!Array.isArray(d.points) || d.points.length === 0) continue;
    const pointsOk = d.points.every(
      (p: unknown) =>
        p != null &&
        typeof p === "object" &&
        "time" in p &&
        "price" in p &&
        typeof (p as { price: unknown }).price === "number",
    );
    if (!pointsOk) continue;
    // Backfill style for pre-toolbar entries (Feature 5b/5c without style).
    if (!d.style || typeof d.style !== "object") {
      d.style = { ...DEFAULT_STYLE };
    }
    valid.push(migrateDrawing(d as Drawing));
  }
  return valid;
}

/** Point-count migration (10/07/2026): several kinds moved to TV's point
 *  models. Old saved drawings are padded/synthesized best-effort so they keep
 *  rendering; a drag then normalises them.
 *   - fib-wedge / pitchfan: 2 → 3 (mirror the second edge across p0's price)
 *   - ellipse: 2 (bbox corners) → 3 (major axis + half-height point)
 *   - price-note: 1 → 2 (degenerate line at the anchor)
 *   - head-and-shoulders: 5 → 7 (duplicate the two outer points)
 *   - elliott impulse/triangle/triple: 5 → 6; correction/double: 3 → 4
 *     (prepend the "0" origin as a copy of the first point) */
export function migrateDrawing(d: Drawing): Drawing {
  const pts = d.points as { time: unknown; price: number }[];
  const n = pts.length;
  const dup = (p: { time: unknown; price: number }) => ({ ...p });
  switch (d.kind) {
    case "polyline":
      // 24/09/2026: TV fills a polyline only once it is closed (`filled`).
      // Polylines saved before the flag were always drawn closed + filled:
      // keep that look. New ones store `closed` explicitly.
      return d.closed === undefined ? ({ ...d, closed: true } as Drawing) : d;
    case "fib-speed-resistance-fan": {
      // 24/09/2026: TV's 0 and 1 levels are real levels (grey); fans saved
      // before drew them implicitly, so add them when missing.
      const lv = d.style.levels;
      if (!lv) return d;
      const has = (c: number) => lv.some((l) => l.coeff === c);
      if (has(0) && has(1)) return d;
      const levels = [
        ...(has(0) ? [] : [{ coeff: 0, color: "#808080", visible: true }]),
        ...lv,
        ...(has(1) ? [] : [{ coeff: 1, color: "#808080", visible: true }]),
      ];
      return { ...d, style: { ...d.style, levels } } as Drawing;
    }
    case "parallel-channel": {
      // 24/09/2026: TV's 7-level ladder. Channels saved before it keep their
      // look (TV v1 -> v2 rule): levels 0 and 1 = the line colour / width /
      // style, level 0.5 = the dashed middle line when it was on.
      if (d.style.levels) return d;
      const st = d.style;
      const { middleLine, ...rest } = st;
      const levels = PARALLEL_CHANNEL_LEVEL_DEFAULTS.map((l) => ({
        ...l,
        color: st.color,
        ...(l.coeff === 0 || l.coeff === 1 ? { width: st.width, style: st.lineStyle ?? "solid" } : {}),
        ...(l.coeff === 0.5 ? { visible: middleLine !== false } : {}),
      }));
      return { ...d, style: { ...rest, levels } } as Drawing;
    }
    case "fib-wedge":
    case "pitchfan":
      if (n === 2) {
        const p2 = { time: pts[1].time, price: 2 * pts[0].price - pts[1].price };
        return { ...d, points: [pts[0], pts[1], p2] } as Drawing;
      }
      return d;
    case "ellipse":
      if (n === 2) {
        const midPrice = (pts[0].price + pts[1].price) / 2;
        const t0 = Number(pts[0].time);
        const t1 = Number(pts[1].time);
        const midTime = Number.isFinite(t0) && Number.isFinite(t1) ? (t0 + t1) / 2 : Number(pts[0].time);
        return {
          ...d,
          points: [
            { time: pts[0].time, price: midPrice },
            { time: pts[1].time, price: midPrice },
            { time: midTime, price: pts[1].price },
          ],
        } as Drawing;
      }
      return d;
    case "price-note":
      if (n === 1) return { ...d, points: [pts[0], dup(pts[0])] } as Drawing;
      return d;
    case "head-and-shoulders":
      if (n === 5) return { ...d, points: [dup(pts[0]), ...pts, dup(pts[4])] } as Drawing;
      return d;
    case "elliott-impulse":
    case "elliott-triangle":
    case "elliott-triple-combo":
      if (n === 5) return { ...d, points: [dup(pts[0]), ...pts] } as Drawing;
      return d;
    case "elliott-correction":
    case "elliott-double-combo":
      if (n === 3) return { ...d, points: [dup(pts[0]), ...pts] } as Drawing;
      return d;
    case "note":
      // 24/09/2026: the 1-point map pin is TV's Pin; "note" is now TV's
      // 2-point text note. Old 1-point notes become pins (same look).
      return n === 1 ? ({ ...d, kind: "pin", points: [pts[0]] } as unknown as Drawing) : d;
    case "anchored-volume-profile":
      // 24/09/2026: TV places it with 1 click (anchor → last bar); older
      // 2-point entries keep their first point as the anchor.
      return n > 1 ? ({ ...d, points: [pts[0]] } as Drawing) : d;
    case "anchored-vwap":
      // 12/07/2026: the Background (band fill) checkbox renders only when
      // `fillBackground` is defined; VWAPs saved before the spec default
      // existed load with it undefined and lose the row.
      if (d.style.fillBackground === undefined) {
        return { ...d, style: { ...d.style, fillBackground: false } } as Drawing;
      }
      return d;
    // Point-MEANING migrations (11/07/2026), marked with fmt: 2 since the
    // count doesn't change and would re-migrate on every load otherwise.
    case "circle":
      // bbox corners → TV's center + radius point: center = corner midpoint,
      // the old second corner stays as the radius point (the new circle
      // circumscribes the old ellipse's box).
      if (d.fmt !== 2 && n === 2) {
        const t0 = Number(pts[0].time);
        const t1 = Number(pts[1].time);
        const midTime = Number.isFinite(t0) && Number.isFinite(t1) ? (t0 + t1) / 2 : pts[0].time;
        const center = { time: midTime, price: (pts[0].price + pts[1].price) / 2 };
        return { ...d, fmt: 2, points: [center, dup(pts[1])] } as Drawing;
      }
      return d;
    case "arc":
      // [start, bezier control, end] → TV's [chord start, chord end, bulge];
      // the old control point becomes the bulge, which keeps roughly the same
      // visual bow.
      if (d.fmt !== 2 && n === 3) {
        return { ...d, fmt: 2, points: [pts[0], pts[2], pts[1]] } as Drawing;
      }
      return d;
    default:
      return d;
  }
}
