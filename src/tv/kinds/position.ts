/*
 * Long / short position (TV LineToolRiskReward, line-tool-risk-reward chunk):
 * the risk model behind the Inputs tab and the stats. Pure TS, shared by the
 * overlay renderer, the hit test / drag code and the Settings dialog.
 *
 * TV RiskRewardCalculator (point value 1, no account currency conversion):
 *   riskSize  = percents: risk / 100 · accountSize; money: min(risk, account)
 *   qty       = min(riskSize / |entry − stop|, leverage · accountSize / entry)
 *   shown qty = _roundQty(qty / lotSize): "default" = floor (stocks), else
 *               rounded to the chosen decimals ("0" = Integer)
 *   levels    = ticks from the entry (TV stores ticks; OpenTrader stores the
 *               price distance, ticks = distance / tick size)
 */
import type { Drawing, DrawingStyle, PositionStatKey } from "../types";

/** TV infoBlocks in the Stats list order, with their titles and factory
 *  visibility (all on except TP PL / SL PL). */
export const POSITION_STATS: ReadonlyArray<readonly [PositionStatKey, string, boolean]> = [
  ["tpPriceOffset", "TP price offset", true],
  ["tpPercentOffset", "TP percent offset", true],
  ["tpTickOffset", "TP tick offset", true],
  ["tpAmount", "TP amount", true],
  ["tpPL", "TP PL", false],
  ["openClosePL", "Open/closed PL", true],
  ["qty", "Qty", true],
  ["riskRewardRatio", "Risk/reward ratio", true],
  ["slPriceOffset", "SL price offset", true],
  ["slPercentOffset", "SL percent offset", true],
  ["slTickOffset", "SL tick offset", true],
  ["slAmount", "SL amount", true],
  ["slPL", "SL PL", false],
];
export function positionStatOn(s: DrawingStyle, k: PositionStatKey): boolean {
  const v = s.positionStats?.[k];
  return v ?? POSITION_STATS.find((x) => x[0] === k)![2];
}

/** TV number formatting in the position labels: price values with the
 *  price precision and thousands commas ("1,000.00", minus U+2212), ticks
 *  with thousands commas ("5,108"), amounts as plain numbers. */
function fmtGrouped(v: number, digits: number): string {
  const t = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return v < 0 ? `\u2212${t}` : t;
}

/** TV _createTargetLabel / _createStopLabel: offset price, percent (3
 *  decimals of |entry|), ticks, amount and PL, each when its stat is on;
 *  full mode "Target: …" / "Stop: …", ", Amount: …", ", PnL: …", compact
 *  mode the bare values joined by spaces. Empty = no label. */
export function positionLegText(
  s: DrawingStyle,
  leg: "tp" | "sl",
  dist: number,
  entry: number,
  pip: number,
  digits: number,
  amount: number,
  pl: number,
): string {
  const on = (k: string) => positionStatOn(s, (leg + k) as PositionStatKey);
  const compact = !!s.compactStats;
  const price = fmtGrouped(dist, digits);
  const pct = `${(entry !== 0 ? Math.round((100 * 1000 * dist) / entry) / 1000 : 0).toFixed(3)}%`;
  let t = "";
  if (on("PriceOffset")) t += compact ? price : `${leg === "tp" ? "Target" : "Stop"}: ${price}`;
  if (on("PercentOffset")) t += t !== "" ? ` (${pct})` : pct;
  if (on("TickOffset")) t += (t !== "" ? " " : "") + fmtGrouped(Math.round(dist / pip), 0);
  if (on("Amount")) t += compact ? (t !== "" ? " " : "") + String(amount) : (t !== "" ? ", " : "") + `Amount: ${amount}`;
  if (on("PL")) t += compact ? (t !== "" ? " " : "") + fmtGrouped(pl, digits) : (t !== "" ? ", " : "") + `PnL: ${fmtGrouped(pl, digits)}`;
  return t;
}

/** TV _createMiddleLabel: open / closed P&L (signed change), qty, risk /
 *  reward ratio; full "{Open|Closed} PnL: …, Qty: …" then "Risk/reward
 *  ratio: …" on a new line, compact "pnl ~ qty" then the ratio. */
export function positionMiddleText(s: DrawingStyle, pnl: string | null, closed: boolean, qty: number, ratio: number): string {
  const compact = !!s.compactStats;
  let t = "";
  if (positionStatOn(s, "openClosePL") && pnl) t += compact ? pnl : `${closed ? "Closed" : "Open"} PnL: ${pnl}`;
  if (positionStatOn(s, "qty")) t += (t !== "" ? (compact ? " ~ " : ", ") : "") + (compact ? String(qty) : `Qty: ${qty}`);
  if (positionStatOn(s, "riskRewardRatio")) t += (t !== "" ? "\n" : "") + (compact ? String(ratio) : `Risk/reward ratio: ${ratio}`);
  return t;
}

/** TV factory inputs (properties defaults of the risk/reward tool). */
export const POSITION_DEFAULTS = { accountSize: 1000, risk: 25, lotSize: 1, leverage: 10000 } as const;

/** Stop / profit price distances; drawings saved before the level model
 *  derive both from the old mirrored close point, else 100 ticks. */
export function positionLevels(d: Drawing, pip: number): { stop: number; profit: number } {
  const p0 = d.points[0];
  const p1 = d.points[1];
  const legacy = p0 && p1 ? Math.abs(p1.price - p0.price) : 0;
  return {
    stop: d.style.stopLevel ?? (legacy || pip * 100),
    profit: d.style.profitLevel ?? (legacy || pip * 100),
  };
}

/** TV riskSize: the money at risk. */
export function positionRiskSize(s: DrawingStyle): number {
  const account = s.accountSize ?? POSITION_DEFAULTS.accountSize;
  if (s.riskDisplayMode === "money") return Math.min(s.riskAmount ?? (account * (s.riskPercent ?? POSITION_DEFAULTS.risk)) / 100, account);
  return ((s.riskPercent ?? POSITION_DEFAULTS.risk) / 100) * account;
}

/** TV _roundQty for a stock: "default" floors, a decimals count rounds. */
export function roundQty(v: number, precision: string | undefined): number {
  if (!precision || precision === "default") return Math.floor(v);
  const k = Math.pow(10, parseInt(precision, 10));
  return Math.round(v * k) / k;
}

/** Raw qty (TV `qty`, drives the amounts) and the shown qty (stats). */
export function positionQty(s: DrawingStyle, entry: number, stop: number): { qty: number; shown: number } {
  const account = s.accountSize ?? POSITION_DEFAULTS.accountSize;
  const leverage = s.leverage ?? POSITION_DEFAULTS.leverage;
  const riskQty = stop > 0 ? positionRiskSize(s) / stop : Infinity;
  const levQty = entry > 0 ? (leverage * account) / entry : Infinity;
  const q = Math.min(riskQty, levQty);
  const qty = Number.isFinite(q) ? q : 0;
  const lot = s.lotSize && s.lotSize > 0 ? s.lotSize : 1;
  return { qty, shown: roundQty(qty / lot, s.qtyPrecision) };
}

/** TV prepare{Long,Short}{Stop,Profit}Price: the typed price rounded to the
 *  tick, kept at least one tick on its side of the entry; returns the level
 *  (price distance from the entry, a whole number of ticks). */
export function levelFromPrice(price: number, entry: number, pip: number, side: 1 | -1, leg: "stop" | "profit"): number {
  const base = 1 / pip;
  const r = Math.round(price * base) / base;
  const below = (side === 1) === (leg === "stop");
  const p = below ? Math.min(r, entry - pip) : Math.max(r, entry + pip);
  return Math.round(Math.abs(p - entry) * base) * pip;
}
