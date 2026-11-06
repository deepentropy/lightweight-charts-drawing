/*
 * Renderer-neutral host hook for label text and number / date format.
 * Scene builders call labelOrDefault where the default string is built,
 * before any measureText / box sizing — never in drawScene.
 */

/** One variant per visible label type; every variant carries the default
 *  `text` (exactly as 0.6.3 builds it) plus the raw inputs. */
export type DrawingLabel =
  | {
      id: "price-range";
      text: string;
      change: number;
      percent: number | null;
      pips: number;
      digits: number;
      price0: number;
      price1: number;
    }
  | { id: "bars-range"; text: string; bars: number }
  | { id: "time-span"; text: string; seconds: number }
  | { id: "distance"; text: string; distancePx: number }
  | { id: "angle"; text: string; degrees: number }
  | { id: "volume"; text: string; volume: number }
  | {
      id: "position-target" | "position-stop";
      text: string;
      distance: number;
      percent: number;
      ticks: number;
      amount: number;
      pnl: number;
      digits: number;
    }
  | {
      id: "position-middle";
      text: string;
      pnl: number | null;
      closed: boolean;
      qty: number;
      ratio: number;
    }
  | {
      id: "forecast";
      text: string;
      change: number;
      percent: number;
      seconds: number | null;
      digits: number;
    }
  | {
      id: "forecast-date";
      text: string;
      time: number;
      timeZone: string;
      intraday: boolean;
    }
  | { id: "price"; text: string; price: number; digits: number };

/** Return the label to draw; undefined / null = the default text. "" draws empty. */
export type LabelFormatter = (label: DrawingLabel) => string | null | undefined;

/** Apply the host formatter when present; otherwise (or on null / undefined) keep `l.text`. */
export function labelOrDefault(
  c: { formatLabel?: LabelFormatter } | null | undefined,
  l: DrawingLabel,
): string {
  const r = c?.formatLabel?.(l);
  return r == null ? l.text : r;
}
