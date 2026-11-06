/*
 * Sample Ukrainian LabelFormatter for the demo page (EN / UA toggle).
 * Hand-written demo strings only — not copied from any host app.
 */
import type { DrawingLabel } from "../src";

const num = (n: number, digits?: number) =>
  new Intl.NumberFormat("uk-UA", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);

const signed = (n: number, digits: number) => {
  const t = num(Math.abs(n), digits);
  return n < 0 ? `\u2212${t}` : t;
};

const span = (seconds: number) => {
  const d = Math.floor(Math.abs(seconds) / 86400);
  if (d >= 1) return `${d} д`;
  const h = Math.floor(Math.abs(seconds) / 3600);
  if (h >= 1) return `${h} год`;
  const m = Math.floor(Math.abs(seconds) / 60);
  if (m >= 1) return `${m} хв`;
  return `${Math.round(Math.abs(seconds))} с`;
};

/** Ukrainian sample text for every DrawingLabel id. */
export function ukLabel(label: DrawingLabel): string | undefined {
  switch (label.id) {
    case "price-range": {
      const pct =
        label.percent == null ? "" : ` (${signed(label.percent, 2)}%)`;
      const pips = ` ${signed(label.pips, 0)}`;
      return `${signed(label.change, label.digits)}${pct}${pips}`;
    }
    case "bars-range":
      return `${label.bars} барів`;
    case "time-span":
      return span(label.seconds);
    case "distance":
      return `відстань: ${Math.round(label.distancePx)} пкс`;
    case "angle":
      return `${num(label.degrees, 2)}\u00ba`;
    case "volume":
      return `Обсяг ${num(label.volume, 0)}`;
    case "position-target":
      return `Ціль: ${num(label.distance, label.digits)} (${num(label.percent, 3)}%) ${num(label.ticks, 0)}, Сума: ${num(label.amount, 0)}`;
    case "position-stop":
      return `Стоп: ${num(label.distance, label.digits)} (${num(label.percent, 3)}%) ${num(label.ticks, 0)}, Сума: ${num(label.amount, 0)}`;
    case "position-middle": {
      const pnl =
        label.pnl == null
          ? ""
          : `${label.closed ? "Закр. PnL" : "Відкр. PnL"}: ${signed(label.pnl, 2)}, `;
      return `${pnl}К-сть: ${num(label.qty, 0)}\nСпіввідношення ризик/прибуток: ${num(label.ratio, 0)}`;
    }
    case "forecast": {
      const when = label.seconds == null ? "" : ` за ${span(label.seconds)}`;
      return `${signed(label.change, label.digits)} (${num(label.percent, 2)}%)${when}`;
    }
    case "forecast-date": {
      const opts: Intl.DateTimeFormatOptions = label.intraday
        ? {
            timeZone: label.timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }
        : { timeZone: label.timeZone, year: "numeric", month: "2-digit", day: "2-digit" };
      return new Intl.DateTimeFormat("uk-UA", opts).format(new Date(label.time * 1000));
    }
    case "price":
      return num(label.price, label.digits);
    case "fib-level": {
      const coeff = num(label.coeff, 3).replace(/0+$/, "").replace(/,$/, "");
      if (label.price == null) return coeff;
      return `${coeff} (${num(label.price, label.digits)})`;
    }
    case "pearson":
      return `R = ${num(label.r, 4)}`;
    case "gann-ratio":
      return num(label.ratio, 7).replace(/0+$/, "").replace(/,$/, "");
    default:
      return undefined;
  }
}
