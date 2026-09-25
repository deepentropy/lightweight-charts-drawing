/*
 * Long / short position and position forecast as scenes (moved from
 * OpenTrader DrawingsOverlay, port phase 2).
 */
import { HANDLE_RADIUS, timeToSec, type Pt } from "../_shared";
import type { Coords } from "../coords";
import type { Drawing, DrawingStyle } from "../types";
import { applyOpacity, parseColor } from "../color";
import { isoDateTimeParts } from "../time";
import { positionAnchors, positionLegText, positionMiddleText, positionQty, positionTrade } from "../kinds/position";
import { forecastArcSamples, forecastStatus } from "../kinds/data-series";
import { FORECAST_CLOCK_ICON, FORECAST_FAILURE_ICON, FORECAST_SUCCESS_ICON } from "../kinds/forecast-icons";
import type { Scene, SceneItem } from "./types";
import { measureText, measureTextBold, signedFixed, tvTimeSpan } from "./text";
import { rangeArrowPath, SQUARE_ANCHORS } from "./lines";

/** Position stats label (TV risk-reward `_addCenterLabel`): 12px text, box
 *  padding 4 × fs/3, corner radius 4, background = the level colour at full
 *  opacity (middle: white 1px border). `align` places the box relative to
 *  `y` like TV's vertAlign: "bottom" = box above y, "top" = box below y. */
function positionLabel(cx: number, y: number, align: "top" | "middle" | "bottom", gap: number, lines: string[], bg: string, s: DrawingStyle, border?: string): SceneItem {
  const fs = s.fontSize ?? 12;
  const padH = 4;
  const padV = fs / 3;
  const boxW = Math.max(...lines.map((l) => measureText(l, fs))) + padH * 2;
  const boxH = fs * lines.length + padV * 2;
  const top = align === "bottom" ? y - gap - boxH : align === "top" ? y + gap : y - boxH / 2 + gap;
  return {
    t: "group",
    inert: true,
    items: [
      { t: "rect", x: cx - boxW / 2, y: top, w: boxW, h: boxH, rx: 4, fill: bg, stroke: border ?? "none", strokeWidth: border ? 1 : 0 },
      ...lines.map((line, i): SceneItem => ({
        t: "text", x: cx, y: top + padV + i * fs + fs / 2, text: line, anchor: "middle", baseline: "central", size: fs, fill: s.textColor ?? "#ffffff",
      })),
    ],
  };
}

/** Risk/reward position tool (TV model). pt0 = entry, pt1 = close point
 *  (price locked to the entry); the stop/profit offsets live on the style
 *  (frozen at placement to 20% of the visible range — 1:1). Stats: middle
 *  pill = open P&L + Qty + Risk/Reward, target/stop pills = distance, %,
 *  amount. Qty = accountSize·risk% / stop distance. `selected` = the active
 *  flag (selected or hovered). */
export function scenePosition(d: Drawing, pts: Pt[], selected: boolean, dir: "long" | "short", s: DrawingStyle, coords: Coords | null | undefined): Scene {
  const pa = positionAnchors(d, pts, coords);
  if (!pa) return [];
  const [a, b] = pts;
  const entry = d.points[0].price;
  const left = Math.min(a.x, b.x);
  const right = Math.max(a.x, b.x);
  const wBox = Math.max(8, right - left);
  const midX = (left + right) / 2;
  // TV stop / target colours: zones and lines at (100 − transparency)%, the
  // P&L zone at 1 − (transparency / 100)³, labels opaque.
  const stopHex = parseColor(s.stopColor ?? "#f23645").hex;
  const targetHex = parseColor(s.targetColor ?? "#089981").hex;
  const stopT = s.stopTransparency ?? 80;
  const targetT = s.targetTransparency ?? 80;
  const up = applyOpacity(targetHex, 100 - targetT);
  const down = applyOpacity(stopHex, 100 - stopT);
  const { yStop, yTarget, stop, profit } = pa;
  // TV risk-reward calculator (line-tool-risk-reward, kinds/position.ts):
  // qty = min(riskSize / |entry − stop|, leverage · account / entry) (stocks:
  // point value 1); shown = qty / lotSize rounded by QTY precision.
  // Amounts = account ± qty·distance, rounded to 2 decimals (roundValue).
  const accountSize = s.accountSize ?? 1000;
  const { qty: qtyRaw, shown: qty } = positionQty(s, entry, stop);
  const round2 = (v: number) => parseFloat(v.toFixed(2));
  const amountTarget = round2(accountSize + profit * qtyRaw);
  const amountStop = round2(accountSize - stop * qtyRaw);
  const ratio = stop > 0 ? Math.round((100 * profit) / stop) / 100 : 0;
  const sign = dir === "long" ? 1 : -1;
  const trade = positionTrade(d, dir, entry - sign * stop, entry + sign * profit, coords);
  // TV lastBarData: the actual close price once closed, else the close of the
  // bar at the close point (or the last bar); P&L = (price − entry) · side.
  const pl = trade ? (trade.closePrice - entry) * sign : null;
  const pip = coords?.pipSize() ?? 0.01;
  const digits = Math.max(0, Math.min(8, Math.round(-Math.log10(pip))));
  // TV label texts from the Stats flags and compact mode (kinds/position.ts);
  // TP / SL PL = (target | stop − entry) · side · qty.
  const targetText = positionLegText(s, "tp", profit, entry, pip, digits, amountTarget, profit * qtyRaw);
  const stopText = positionLegText(s, "sl", stop, entry, pip, digits, amountStop, -stop * qtyRaw);
  const midText = positionMiddleText(s, pl != null ? signedFixed(pl, digits) : null, !!trade?.closed, qty, ratio);
  const midLines = midText ? midText.split("\n") : [];
  const midBg = pl != null && pl < 0 ? stopHex : pl != null && pl > 0 ? targetHex : s.color;
  // Screen geometry of the actual trade (TV entryX / right / closeLevel).
  const xAt = (i: number) => {
    const bars = coords?.bars() ?? [];
    const t = bars[i]?.time;
    return t != null && coords ? coords.timeToX(t) : null;
  };
  const yClose = trade && coords ? coords.priceToY(trade.closePrice) : null;
  const entryX = trade?.entryIndex != null ? xAt(trade.entryIndex) : b.x;
  const rightX = trade?.closeIndex != null ? xAt(trade.closeIndex) : b.x;
  const pnlZone =
    entryX != null && rightX != null && yClose != null && entryX !== rightX
      ? { x: Math.min(entryX, rightX), y: Math.min(a.y, yClose), w: Math.abs(rightX - entryX), h: Math.abs(yClose - a.y) }
      : null;
  const lineEndX = trade ? xAt(trade.closed ? trade.closeIndex! : trade.barIndex) : null;
  const posLine =
    trade?.entryIndex != null && entryX != null && lineEndX != null && yClose != null
      ? { from: { x: entryX, y: a.y }, to: { x: lineEndX, y: yClose } }
      : null;
  // TV shows the stats on hover / selection only, unless "Always show stats".
  const showStats = selected || !!s.showStats;
  // Narrow box (TV): when the labels don't fit beside the anchors, the target
  // / stop labels move 14px (anchor radius + 8) away from their lines and the
  // middle label shifts toward the smaller leg.
  const labelW = Math.max(
    0,
    measureText(targetText, s.fontSize ?? 12),
    measureText(stopText, s.fontSize ?? 12),
    ...midLines.map((l) => measureText(l, s.fontSize ?? 12)),
  ) + 8;
  const narrow = right - left - labelW - HANDLE_RADIUS <= 8;
  const gap = narrow ? HANDLE_RADIUS + 8 : 0;
  const midShift = narrow
    ? (yTarget < yStop ? 1 : -1) * (profit > stop ? -1 : 1) * (0.5 * ((s.fontSize ?? 12) * 2 + (2 * (s.fontSize ?? 12)) / 3) + HANDLE_RADIUS + 8)
    : 0;
  const out: Scene = [
    { t: "rect", x: left, y: Math.min(yTarget, yStop), w: wBox, h: Math.abs(yTarget - yStop), fill: "transparent" },
    // profit + stop zones; the P&L zone from the actual entry to the actual
    // close (or the close point) between the entry and close prices, alpha
    // 1 − (transparency / 100)^3 (TV)
    { t: "rect", x: left, y: Math.min(a.y, yStop), w: wBox, h: Math.abs(yStop - a.y), fill: down },
  ];
  if (pnlZone && pl != null && pl < 0) out.push({ t: "rect", ...pnlZone, fill: stopHex, fillOpacity: 1 - (stopT / 100) ** 3 });
  out.push({ t: "rect", x: left, y: Math.min(a.y, yTarget), w: wBox, h: Math.abs(yTarget - a.y), fill: up });
  if (pnlZone && pl != null && pl > 0) out.push({ t: "rect", ...pnlZone, fill: targetHex, fillOpacity: 1 - (targetT / 100) ** 3 });
  // TV position line: dashed 1px, line colour, arrow at the end, from the
  // actual entry to the actual close (or the close bar's close)
  if (posLine) {
    out.push(
      { t: "line", a: posLine.from, b: posLine.to, stroke: s.color, strokeWidth: 1, dash: "6 4", inert: true },
      { t: "path", d: rangeArrowPath(posLine.from, posLine.to, 1), fill: "none", stroke: s.color, strokeWidth: 1, inert: true },
    );
  }
  // entry / target / stop lines; TV draws the stop / target lines in the zone
  // colours (factory alpha 0.2) at the Lines width
  out.push(
    { t: "line", a: { x: left, y: a.y }, b: { x: right, y: a.y }, stroke: s.color, strokeWidth: s.width },
    { t: "line", a: { x: left, y: yTarget }, b: { x: right, y: yTarget }, stroke: up, strokeWidth: s.width },
    { t: "line", a: { x: left, y: yStop }, b: { x: right, y: yStop }, stroke: down, strokeWidth: s.width },
  );
  // stats labels (TV: target above its line for a long, stop below, middle on
  // the entry line)
  if (showStats) {
    if (targetText) out.push(positionLabel(midX, yTarget, yTarget < a.y ? "bottom" : "top", gap, [targetText], targetHex, s));
    if (midLines.length > 0) out.push(positionLabel(midX, a.y, "middle", midShift, midLines, midBg, s, "#ffffff"));
    if (stopText) out.push(positionLabel(midX, yStop, yStop > a.y ? "top" : "bottom", gap, [stopText], stopHex, s));
  }
  if (selected) out.push({ t: "anchors", pts: pa.anchors, squares: SQUARE_ANCHORS.position });
  return out;
}

/* ---------- forecast (2-point; LineToolPrediction → "Position forecast") ----
 * Per the line-tool-prediction chunk (module 176288): p0 = source, p1 = target.
 * The vector is a QUARTER ELLIPSE centred at (source.x, target.y) with
 * rx=|dx| / ry=|dy| plus a tangent arrowhead at the target (size max(8, 4·lw)).
 * Source balloon (price 12px / date 10px, height 32) hangs on the direction
 * side of the source; target balloon ("±Δ (pct%)  in <span>" 14px / "price
 * date" 11px, height 38) on the opposite side of the target; both are rounded
 * cards with a 5px pointed tail and a small #202020 dot on the anchor.
 * Status (`recalculateStateByData`): success once the target bar's high (up) /
 * low (down) touches the target price, failure when the target bar has passed
 * without touching, waiting while the target is still in the future — drawn as
 * an 18px bold banner glued to the balloon (iguana-green / ripe-red factory
 * backgrounds). Balloon fills use the factory transparency 10. The clock /
 * success / failure icons are TV's PNGs (kinds/forecast-icons.ts), drawn 1:1. */
const FORECAST_CENTER_DOT = "#202020"; // centersColor factory
/** Width of the clock image TV draws before the target date (clockWhite). */
const FORECAST_CLOCK_W = FORECAST_CLOCK_ICON.w;
/** TV DateFormatter "yyyy-mm-dd", plus `sep` + "HH:mm" on intraday charts,
 *  in the chart's time zone (bar times are UTC epoch seconds). */
function fmtForecastDate(t: unknown, sep: string, coords: Coords | null): string {
  const n = timeToSec(t as import("lightweight-charts").Time);
  if (n == null) return "";
  const info = coords?.timeInfo() ?? { timeZone: "UTC", intraday: true };
  const { date, time } = isoDateTimeParts(n, info.timeZone);
  return info.intraday ? `${date}${sep}${time}` : date;
}

type BalloonProps = {
  cx: number;
  y: number;
  below: boolean;
  paneW: number;
  height: number;
  rows: { text: string; size: number; dy?: number; clockThen?: string }[];
  bg: string;
  stroke: string;
  fg: string;
  opacity: number;
  banner?: { text: string; bg: string; fg: string; above: boolean; icon: { href: string; w: number; h: number } };
};

/** One prediction balloon: rounded card with a pointed tail at the anchor,
 *  anchored 11px off the point (chunk: 6px offset + 5px tail), extending 20px
 *  left of the anchor unless the pane's right edge pushes it further left.
 *  `banner` glues the bold status strip to the far edge of the card. */
function forecastBalloon(props: BalloonProps): SceneItem {
  // TV: width = the widest row (+ clock icon and 2 spaces on the date row) + 12.
  const rowW = (r: { text: string; size: number; clockThen?: string }) =>
    measureText(r.text, r.size) + (r.clockThen ? FORECAST_CLOCK_W + 2 * measureText(" ", r.size) + measureText(r.clockThen, r.size) : 0);
  const w = Math.max(...props.rows.map(rowW)) + 12;
  const h = props.height;
  // Chunk: leftOffset = max(20, min(w − 15, point.x + w − paneWidth + 5)).
  const leftOff = Math.max(20, Math.min(w - 15, props.cx + w - props.paneW + 5));
  const x = props.cx - leftOff;
  const top = props.below ? props.y + 11 : props.y - 11 - h;
  const tailY = props.below ? top : top + h;
  const tailTip = props.y + (props.below ? 3 : -3);
  let rowY = top + 4;
  const items: SceneItem[] = [
    { t: "rect", x, y: top, w, h, rx: 3, fill: props.bg, fillOpacity: props.opacity, stroke: props.stroke, strokeOpacity: props.opacity, strokeWidth: 2 },
    { t: "path", d: `M ${props.cx - 5} ${tailY} L ${props.cx} ${tailTip} L ${props.cx + 5} ${tailY} Z`, fill: props.bg, fillOpacity: props.opacity },
    { t: "circle", cx: props.cx, cy: props.y, r: 3, fill: FORECAST_CENTER_DOT },
  ];
  for (const r of props.rows) {
    const y = r.dy != null ? top + r.dy : rowY;
    rowY = y + r.size + 4;
    items.push({ t: "text", x: x + 6, y, text: r.text, size: r.size, fill: props.fg, baseline: "hanging" });
    if (r.clockThen) {
      // TV: clock image at (text x + date width + 1 space, row top + 1).
      const cx0 = x + 6 + measureText(r.text, r.size) + measureText(" ", r.size);
      items.push(
        { t: "image", href: FORECAST_CLOCK_ICON.href, x: cx0, y: y + 1, w: FORECAST_CLOCK_ICON.w, h: FORECAST_CLOCK_ICON.h },
        { t: "text", x: cx0 + FORECAST_CLOCK_W + measureText(" ", r.size), y, text: r.clockThen, size: r.size, fill: props.fg, baseline: "hanging" },
      );
    }
  }
  const bn = props.banner;
  if (bn) {
    // TV: bold 14px text left-aligned at round((w − textW) / 2), top 3px into
    // the 18px strip; icon 4px left of the text, centred (TV's own offsets:
    // +|18 − h| / 2 above the card, 8 − |18 − h| / 2 below).
    const bannerH = 18;
    const bannerTop = bn.above ? top - bannerH - 2 : top + h + 2;
    const tw = measureTextBold(bn.text, 14);
    const tx = x + Math.round((w - tw) / 2);
    const ic = bn.icon;
    const iy = bn.above ? bannerTop + Math.abs(bannerH - ic.h) / 2 : bannerTop + 8 - Math.abs(bannerH - ic.h) / 2;
    items.push(
      { t: "rect", x: x - 1, y: bannerTop, w: w + 2, h: bannerH, rx: 5, fill: bn.bg, fillOpacity: props.opacity },
      { t: "text", x: tx, y: bannerTop + 3, text: bn.text, size: 14, weight: "bold", fill: bn.fg, baseline: "hanging" },
      { t: "image", href: ic.href, x: tx - ic.w - 4, y: iy, w: ic.w, h: ic.h },
    );
  }
  return { t: "group", inert: true, items };
}

export function sceneForecast(d: Drawing, pts: Pt[], selected: boolean, w: number, s: DrawingStyle, coords: Coords | null): Scene {
  if (d.kind !== "position-forecast") return [];
  const [a, b] = pts;
  const up = b.y <= a.y; // screen-space direction (price-up renders upward)
  const samples = forecastArcSamples(a, b);
  // Tangent arrowhead at the target (chunk: triangle of size max(8, 4·lw)).
  const prev = samples[samples.length - 2] ?? a;
  const tLen = Math.hypot(b.x - prev.x, b.y - prev.y) || 1;
  const ux = (b.x - prev.x) / tLen;
  const uy = (b.y - prev.y) / tLen;
  const hd = Math.max(8, 4 * s.width);
  const bx = b.x - ux * hd;
  const by = b.y - uy * hd;
  const head: Pt[] = [b, { x: bx - uy * (hd / 2), y: by + ux * (hd / 2) }, { x: bx + uy * (hd / 2), y: by - ux * (hd / 2) }];
  const dPrice = d.points[1].price - d.points[0].price;
  const pct = d.points[0].price !== 0 ? (dPrice / Math.abs(d.points[0].price)) * 100 : 0;
  const t0 = timeToSec(d.points[0].time);
  const t1 = timeToSec(d.points[1].time);
  // TV line-tool-prediction texts: target "1.74 (7.04%) in 1d 21h 30m" /
  // "26.40 [clock] 2026-09-02  11:30"; source "24.67" / "2026-08-31 14:00".
  const span = t0 != null && t1 != null ? tvTimeSpan(t1 - t0) : "";
  const pip = coords?.pipSize() ?? 0.01;
  const digits = Math.max(0, Math.min(8, Math.round(-Math.log10(pip))));
  const status = forecastStatus(d, coords);
  // TV: backgrounds, borders and banners at the drawing's transparency.
  const op = Math.max(0, Math.min(1, (100 - (s.transparency ?? 10)) / 100));
  const out: Scene = [
    { t: "polyline", pts: samples, fill: "none", stroke: "transparent", strokeWidth: 12 },
    { t: "polyline", pts: samples, fill: "none", stroke: s.color, strokeWidth: s.width, join: "round" },
    { t: "polygon", pts: head, fill: s.color, stroke: s.color, strokeWidth: 1, join: "round" },
    // source balloon on the direction side; target balloon opposite
    forecastBalloon({
      cx: a.x,
      y: a.y,
      below: up,
      paneW: w,
      height: 32,
      rows: [
        { text: d.points[0].price.toFixed(digits), size: 12, dy: 4 },
        { text: fmtForecastDate(d.points[0].time, " ", coords), size: 10, dy: 18 },
      ],
      bg: s.sourceBackColor ?? "#2962FF",
      stroke: s.sourceStrokeColor ?? "#2962FF",
      fg: s.sourceTextColor ?? "#ffffff",
      opacity: op,
    }),
    forecastBalloon({
      cx: b.x,
      y: b.y,
      below: !up,
      paneW: w,
      height: 38,
      rows: [
        { text: `${signedFixed(dPrice, digits)} (${signedFixed(Math.round(pct * 100) / 100, 2)}%)${span ? ` in ${span}` : ""}`, size: 14, dy: 5 },
        { text: d.points[1].price.toFixed(digits), size: 11, dy: 22, clockThen: fmtForecastDate(d.points[1].time, "  ", coords) },
      ],
      bg: s.targetBackColor ?? "#2962FF",
      stroke: s.targetStrokeColor ?? "#2962FF",
      fg: s.targetTextColor ?? "#ffffff",
      opacity: op,
      banner:
        status === "waiting"
          ? undefined
          : {
              text: status === "success" ? "SUCCESS" : "FAILURE",
              icon: status === "success" ? FORECAST_SUCCESS_ICON : FORECAST_FAILURE_ICON,
              bg: status === "success" ? s.successBackground ?? "#4caf50" : s.failureBackground ?? "#F23645",
              fg: status === "success" ? s.successTextColor ?? "#ffffff" : s.failureTextColor ?? "#ffffff",
              above: up,
            },
    }),
  ];
  if (selected) out.push({ t: "anchors", pts });
  return out;
}
