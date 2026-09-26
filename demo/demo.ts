/*
 * Demo of the DrawingManager on a candlestick chart of SPY (demo/public):
 * every tool of the core specs, magnet, keep drawing, JSON export / import
 * (kept in localStorage), an event log. `window.dm` / `window.chart` /
 * `window.series` for scripted checks; `window.autoText` answers the text
 * editor request without a prompt.
 */
import { CandlestickSeries, createChart, type Time } from "lightweight-charts";
import { cacheImage, decodeImage, DrawingManager, OVERLAY_SPECS, type DrawingKind, type MagnetMode } from "../src";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const log = (s: string) => {
  const el = $("log");
  el.textContent = `${new Date().toISOString().slice(11, 23)} ${s}\n` + (el.textContent ?? "").slice(0, 20000);
};

async function main() {
  const csv = await (await fetch(`${import.meta.env.BASE_URL}SPY.csv`)).text();
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
  const KEY = "lwcd-demo-drawings";
  $("export").onclick = () => {
    localStorage.setItem(KEY, dm.exportJSON());
    log(`export ${dm.drawings().length} drawings (localStorage)`);
  };
  $("import").onclick = () => log(`import ${dm.importJSON(localStorage.getItem(KEY) ?? "[]")} drawings`);
  $("clear").onclick = () => dm.clear();
  // TV Image tool: the host reads the file and puts it in the core image
  // cache under a name; the drawing stores the name.
  const file = $<HTMLInputElement>("imageFile");
  $("image").onclick = () => file.click();
  file.onchange = async () => {
    const f = file.files?.[0];
    if (!f) return;
    const url = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); });
    const img = await decodeImage(url);
    const name = `${Date.now().toString(36)}-${f.name}`;
    cacheImage(name, img);
    dm.addImage({ name, width: img.width, height: img.height });
    file.value = "";
  };

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
  // TV table: a click on a cell of the selected table opens the host editor.
  dm.on("tableEdit", (d, cell) => {
    log(`tableEdit ${d.id} cell ${cell.join(",")}`);
    const auto = (window as unknown as { autoText?: string }).autoText;
    const cells = (d.style as { tableCells?: string[][] }).tableCells;
    const text = auto ?? prompt(`Cell ${cell.join(",")}`, cells?.[cell[0]]?.[cell[1]] ?? "");
    if (text != null) dm.setTableCellText(d.id, cell, text);
    dm.endTableEdit();
  });
  dm.on("change", (list) => { $("count").textContent = `${list.length} drawings`; });
  dm.on("gestureEnd", () => log("gestureEnd"));
}

void main();
