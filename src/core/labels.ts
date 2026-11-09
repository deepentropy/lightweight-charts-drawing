/*
 * Renderer-neutral host hook for label text and number / date format.
 * Scene builders call labelOrDefault where the default string is built,
 * before any measureText / box sizing — never in drawScene.
 */

/** One variant per visible label type as scene builders write it: the default
 *  `text` (exactly as 0.6.3 builds it) plus the raw inputs. `kind` and
 *  `drawingId` are merged in by labelOrDefault from the per-drawing context,
 *  never written at the call sites. */
type DrawingLabelBody =
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
  | { id: "price"; text: string; price: number; digits: number }
  | {
      id: "fib-level";
      text: string;
      coeff: number;
      price: number | null;
      digits: number;
    }
  | { id: "pearson"; text: string; r: number }
  /** A fixed word the library draws: a pattern point name ("Head"), the forecast
   *  status ("SUCCESS"), the faint placeholder of an empty text drawing ("Add text"). */
  | { id: "caption"; text: string }
  | { id: "gann-ratio"; text: string; ratio: number }
  | {
      /** One row of a stats box (trend-line family, range tools). `text` is the
       *  library join of the row's pieces, `parts` are the piece labels (each
       *  with the text it will draw), `row` is the 0-based row index. */
      id: "stats-row";
      text: string;
      row: number;
      parts: DrawingLabel[];
    };

/** Which drawing a label belongs to; `drawingId` is "__preview__" while placing. */
export type LabelContext = { kind: string; drawingId: string };

/** Every label the hook receives: the variant plus its drawing's kind and id. */
export type DrawingLabel = DrawingLabelBody & LabelContext;

/** Return the label to draw; undefined / null = the default text. "" draws empty. */
export type LabelFormatter = (label: DrawingLabel) => string | null | undefined;

type LabelHost = { formatLabel?: LabelFormatter; labelContext?: LabelContext };

/** The label as the hook sees it (context merged) and the text it draws:
 *  the hook's string, or `l.text` on null / undefined. */
export function labelPart(c: LabelHost | null | undefined, l: DrawingLabelBody): DrawingLabel {
  // The context is set by sceneOf / hitTestKind; a bare call has none.
  const full = { ...l, ...c?.labelContext } as DrawingLabel;
  const r = c?.formatLabel?.(full);
  return r == null ? full : { ...full, text: r };
}

/** Apply the host formatter when present; otherwise (or on null / undefined) keep `l.text`. */
export function labelOrDefault(c: LabelHost | null | undefined, l: DrawingLabelBody): string {
  return c?.formatLabel ? labelPart(c, l).text : l.text;
}

/** Run `fn` with the label context of drawing `d` on `c`: every label built inside
 *  carries its kind and id. Restores the previous context (calls may nest). Only
 *  needed with a hook, so hook-less painting stays allocation-free. */
export function withLabelContext<T>(
  c: LabelHost | null | undefined,
  d: { kind: string; id: string },
  fn: () => T,
): T {
  if (!c?.formatLabel) return fn();
  const prev = c.labelContext;
  c.labelContext = { kind: d.kind, drawingId: d.id };
  try {
    return fn();
  } finally {
    c.labelContext = prev;
  }
}
