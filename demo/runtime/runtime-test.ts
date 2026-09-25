/*
 * Runtime test page (port phase 3.3): the DrawingManager on a candlestick
 * chart of demo/SPY.csv, every tool of the core specs, magnet, keep drawing,
 * an event log. `window.dm` / `window.chart` for scripted checks.
 */
import { CandlestickSeries, createChart, type Time } from "lightweight-charts";
import { DrawingManager, type MagnetMode } from "../../src/runtime/manager";
import { OVERLAY_SPECS } from "../../src/tv/specs";
import type { DrawingKind } from "../../src/tv/types";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const log = (s: string) => {
  const el = $("log");
  el.textContent = `${new Date().toISOString().slice(11, 23)} ${s}\n` + (el.textContent ?? "").slice(0, 20000);
};

async function main() {
  const csv = await (await fetch("/SPY.csv")).text();
  const rows = csv.trim().split("\n").slice(1).map((l) => l.split(",").map(Number));
  const data = rows.slice(-600).map(([t, o, h, l, c]) => ({ time: t as Time, open: o, high: h, low: l, close: c }));
  const chart = createChart($("chart"), {
    autoSize: true,
    layout: { background: { color: "#0f0f0f" }, textColor: "#dbdbdb", fontFamily: getComputedStyle(document.body).fontFamily },
    grid: { vertLines: { color: "#1f1f1f" }, horzLines: { color: "#1f1f1f" } },
    timeScale: { timeVisible: true },
  });
  const series = chart.addSeries(CandlestickSeries, { upColor: "#089981", downColor: "#f23645", borderVisible: false, wickUpColor: "#089981", wickDownColor: "#f23645" });
  series.setData(data);
  const dm = new DrawingManager(chart, series, { magnet: "off" });
  Object.assign(window, { dm, chart, series });

  const tool = $<HTMLSelectElement>("tool");
  for (const kind of Object.keys(OVERLAY_SPECS).sort()) tool.add(new Option(kind, kind));
  tool.onchange = () => dm.setTool((tool.value || null) as DrawingKind | null);
  $<HTMLSelectElement>("magnet").onchange = (e) => dm.setMagnet((e.target as HTMLSelectElement).value as MagnetMode);
  $<HTMLInputElement>("stay").onchange = (e) => dm.setStayInDrawingMode((e.target as HTMLInputElement).checked);
  $("export").onclick = () => log(dm.exportJSON());
  $("clear").onclick = () => dm.clear();

  dm.on("add", (d) => log(`add ${d.kind} ${d.id} ${JSON.stringify(d.points)}`));
  dm.on("remove", (d) => log(`remove ${d.kind} ${d.id}`));
  dm.on("selection", (ids) => log(`selection [${ids.join(", ")}]`));
  dm.on("tool", (k) => { log(`tool ${k}`); tool.value = k ?? ""; });
  dm.on("textEdit", (d, p) => {
    log(`textEdit ${d.kind} at ${Math.round(p.x)},${Math.round(p.y)}`);
    // Scripted runs set window.autoText (a prompt would block them).
    const auto = (window as unknown as { autoText?: string }).autoText;
    const text = auto ?? prompt(`Text for ${d.kind}`, d.text ?? "");
    if (text != null) dm.update({ ...d, text });
  });
  dm.on("change", (list) => { $("count").textContent = `${list.length} drawings`; });
  dm.on("gestureEnd", () => log("gestureEnd"));
}

void main();
