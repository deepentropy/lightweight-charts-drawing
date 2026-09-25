/*
 * Text tools as scenes (moved from OpenTrader DrawingsOverlay, port phase 2):
 * text, pin, note, comment, signpost, price note, callout, table, image. The
 * inline editors (text input, table cell editing, table edge hover) stay in
 * the host; the table scene takes the host's table UI state.
 */
import { tvTextLayout } from "../kinds/tv-text";
import { HIT_TOLERANCE, type Pt } from "../_shared";
import type { Coords } from "../coords";
import type { Drawing, DrawingStyle } from "../types";
import { applyOpacity, parseColor } from "../color";
import { annText, calloutLayout, calloutPath, commentLayout, PIN_MARKER_PATH, pinLayout, pinTooltipPath, roundRectPath, textToolLayout, toolText } from "../kinds/text-tools";
import { SIGNPOST_COLORS, signpostLayout } from "../kinds/signpost";
import { priceNoteLabel } from "../kinds/price-note";
import { tableAnchors, tableLayout, TABLE_ACTIVE_COLOR, TABLE_ACTIVE_LINE, TABLE_BORDER, TABLE_EDGE_COLOR, TABLE_LINE_HEIGHT, TABLE_PAD, type TableUi } from "../kinds/table";
import { drawingImage, imageAnchors, imageBox } from "../kinds/images";
import type { Scene, SceneItem, Shadow } from "./types";
import { measureText, tvTextItems } from "./text";
import { SQUARE_ANCHORS } from "./lines";

/** Drop shadow of the note / pin boxes: rgba(0,0,0,0.4) blur 4 offset 2. */
const BOX_SHADOW: Shadow = { dx: 0, dy: 2, blur: 4, color: "rgba(0,0,0,0.4)" };
/** Drop shadow of the signpost plate: offset 1. */
const PLATE_SHADOW: Shadow = { dx: 0, dy: 1, blur: 4, color: "rgba(0,0,0,0.4)" };

/** A colour at 50% (the faint placeholder text). */
const faintColor = (c: string) => applyOpacity(parseColor(c).hex, 50);

/** TV text (line-tool-text): the text box top-left at the point, padding
 *  fs / 6, optional background (its colour with the transparency), border
 *  (width max(fs / 12, 1), outside the box) and word wrap (a resize anchor at
 *  the right middle, index 1); an outline while hovered / selected (TV
 *  TextRenderer outlineBorder: 1.5px (2px on screen) ring outside the box and
 *  the border, tv-blue-500 when selected, at 40% when hovered); no anchor
 *  otherwise. Empty = "Add text" at 50%. */
export function sceneTextTool(d: Drawing, p: Pt, selected: boolean, hovered: boolean): Scene {
  const s = d.style;
  const l = textToolLayout(d, p);
  const faint = toolText(d).faint;
  const bw = Math.max(1, Math.round(Math.max((s.fontSize ?? 14) / 12, 1)));
  const outline = selected ? "#2962ff" : hovered ? "rgba(41, 98, 255, 0.4)" : null;
  const box = l.box;
  const out: Scene = [
    {
      t: "rect", x: box.left, y: box.top, w: box.width, h: box.height,
      fill: s.fillBackground ? applyOpacity(parseColor(s.backgroundColor ?? s.color).hex, 100 - (s.transparency ?? 75)) : "transparent",
    },
  ];
  if (s.drawBorder) {
    out.push({ t: "rect", x: box.left - bw / 2, y: box.top - bw / 2, w: box.width + bw, h: box.height + bw, fill: "none", stroke: s.borderColor ?? "#707070", strokeWidth: bw, inert: true });
  }
  out.push(tvTextItems(l, faint ? faintColor(s.color) : s.color, s.bold, s.italic));
  if (outline) {
    const o = s.drawBorder ? bw : 0;
    out.push({
      t: "path",
      d: `M ${box.left - o - 2} ${box.top - o - 2} h ${box.width + 2 * o + 4} v ${box.height + 2 * o + 4} h ${-(box.width + 2 * o + 4)} Z M ${box.left - o} ${box.top - o} v ${box.height + 2 * o} h ${box.width + 2 * o} v ${-(box.height + 2 * o)} Z`,
      fill: outline,
      fillRule: "evenodd",
      inert: true,
    });
  }
  if (selected && s.wordWrap) out.push({ t: "anchors", pts: [{ x: box.left + box.width, y: box.top + box.height / 2 }] });
  return out;
}

/** TV pin (line-tool-note): the 24 x 30 marker (markerColor) standing on the
 *  point; on hover / selection the text tooltip (kinds/text-tools.ts
 *  pinLayout): background with its transparency and a drop shadow
 *  rgba(0,0,0,0.4) blur 4 offset 2, optional 1px border, text 12px in. */
export function scenePin(d: Drawing, p: Pt, active: boolean, w: number): Scene {
  const s = d.style;
  const out: Scene = [{ t: "path", d: PIN_MARKER_PATH, transform: `translate(${p.x - 12} ${p.y - 30})`, fill: s.color, fillRule: "evenodd" }];
  if (!active) return out;
  const t = pinLayout(d, p, w);
  const faint = toolText(d).faint;
  const textColor = s.textColor ?? "#dbdbdb";
  const tip: SceneItem[] = [];
  if (s.fillBackground !== false) {
    tip.push({ t: "path", d: pinTooltipPath(t, p.x), fill: applyOpacity(parseColor(s.backgroundColor ?? "#2e2e2e").hex, 100 - (s.transparency ?? 0)), shadow: BOX_SHADOW });
  }
  if (s.drawBorder) tip.push({ t: "path", d: pinTooltipPath(t, p.x), fill: "none", stroke: s.borderColor ?? "#4a4a4a", strokeWidth: 1, inert: true });
  t.lines.forEach((ln, k) => {
    tip.push({
      t: "text", x: t.left + 12, y: t.top + 12 + t.fs / 2 + k * (t.fs + 5), text: ln, baseline: "central", size: t.fs,
      weight: s.bold ? 700 : 400, fontStyle: s.italic ? "italic" : "normal", fill: faint ? faintColor(textColor) : textColor, pre: true, inert: true,
    });
  });
  out.push({ t: "group", items: tip }, { t: "anchors", pts: [p] });
  return out;
}

/** Note (TV LineToolTextNote): 2 points — a 1px leader line P0→P1 in the
 *  line colour (#DBDBDB), a dot at P0 (radius 2, 1px #1f1f1f ring) and the
 *  text box at P1: 14px #DBDBDB text on #2E2E2E, padding 8 × 6, radius 4,
 *  shadow rgba(0,0,0,0.4) blur 4 offset 2. The box side follows the line
 *  direction (TV alignByAngle): up → centred above P1, right → starts at P1,
 *  down → centred below P1, left → ends at P1. */
export function sceneTextNote(d: Drawing, pts: Pt[], selected: boolean, s: DrawingStyle): Scene {
  const [a, b] = pts;
  if (!b) return [];
  const { txt, faint } = annText(d);
  const fs = s.fontSize ?? 14;
  const boxW = measureText(txt, fs) + 16;
  const boxH = fs + 12;
  const ang = Math.round((180 * Math.atan2(b.y - a.y, b.x - a.x)) / Math.PI);
  let x = b.x;
  let y = b.y - boxH / 2;
  if (ang >= -135 && ang <= -45) {
    x = b.x - boxW / 2;
    y = b.y - boxH;
  } else if (ang > -45 && ang < 45) {
    x = b.x;
  } else if (ang >= 45 && ang <= 135) {
    x = b.x - boxW / 2;
    y = b.y;
  } else {
    x = b.x - boxW;
  }
  const lineColor = s.color ?? "#dbdbdb";
  const out: Scene = [
    { t: "hit", a, b, width: HIT_TOLERANCE * 2 },
    { t: "line", a, b, stroke: lineColor, strokeWidth: 1 },
    { t: "circle", cx: a.x, cy: a.y, r: 2, fill: lineColor },
    { t: "circle", cx: a.x, cy: a.y, r: 2.5, fill: "none", stroke: "#1f1f1f", strokeWidth: 1 },
    {
      t: "rect", x, y, w: boxW, h: boxH, rx: 4,
      fill: s.fillBackground === false ? "transparent" : (s.backgroundColor ?? "#2e2e2e"),
      stroke: s.drawBorder ? s.borderColor ?? "#4a4a4a" : undefined,
      strokeWidth: s.drawBorder ? 1 : undefined,
      shadow: s.fillBackground === false && !s.drawBorder ? undefined : BOX_SHADOW,
    },
    {
      t: "text", x: x + 8, y: y + boxH / 2, text: txt, size: fs, weight: s.bold ? 700 : 400, fontStyle: s.italic ? "italic" : "normal",
      fill: s.textColor ?? "#dbdbdb", baseline: "central", opacity: faint ? 0.6 : 1,
    },
  ];
  if (selected) out.push({ t: "anchors", pts });
  return out;
}

/** TV comment: the text box above-right of the point (padding round(fs /
 *  1.3) x 12) drawn as a balloon: radius min(width, fs + 2 padV) / 2 with a
 *  2px corner at the point, background with its transparency, border 2px;
 *  white 16px text (factory); anchor at the point. */
export function sceneComment(d: Drawing, pts: Pt[], selected: boolean, s: DrawingStyle): Scene {
  const [c] = pts;
  const { l, r } = commentLayout(d, c);
  const faint = toolText(d).faint;
  const textColor = s.textColor ?? "#ffffff";
  const b = l.box;
  const out: Scene = [
    {
      t: "path", d: roundRectPath(b.left, b.top, b.width, b.height, [r, r, r, 2]),
      fill: applyOpacity(parseColor(s.backgroundColor ?? s.color).hex, 100 - (s.transparency ?? 0)), stroke: s.borderColor ?? s.color, strokeWidth: 2,
    },
    tvTextItems(l, faint ? faintColor(textColor) : textColor),
  ];
  if (selected) out.push({ t: "anchors", pts });
  return out;
}

/** TV signpost (kinds/signpost.ts): the pole (cold-gray-500, 1px) from the
 *  bar's high / low to the label, the label box (padding 6 x 8, radius 4,
 *  #0F0F0F with a #2E2E2E border, #DBDBDB 12px text, wrap 134) at the
 *  position percent, and with "Emoji pin" the 35px plate (plate colour,
 *  shadow, 1px border) with the emoji between label and bar. Anchor at the
 *  label point (vertical move). */
export function sceneSignpost(d: Drawing, p: Pt, coords: Coords | null, paneH: number, active: boolean): Scene {
  const v = coords ? signpostLayout(d, p, coords, paneH) : null;
  if (!v) return [];
  const out: Scene = [{ t: "line", a: { x: v.x, y: v.poleStart }, b: { x: v.x, y: v.poleEnd }, stroke: SIGNPOST_COLORS.pole, strokeWidth: 1 }];
  if (v.gap) out.push({ t: "line", a: { x: v.x, y: v.gap[0] }, b: { x: v.x, y: v.gap[1] }, stroke: SIGNPOST_COLORS.pole, strokeWidth: 1 });
  if (d.style.showImage) {
    out.push(
      { t: "circle", cx: v.x, cy: v.plateY, r: 35, fill: d.style.plateColor ?? "#2962ff", stroke: SIGNPOST_COLORS.plateBorder, strokeWidth: 1, shadow: PLATE_SHADOW },
      { t: "text", x: v.x, y: v.plateY, text: d.glyph || "🙂", anchor: "middle", baseline: "central", size: 32, inert: true },
    );
  }
  const box = v.l.box;
  out.push(
    { t: "rect", x: box.left, y: box.top, w: box.width, h: box.height, rx: 4, fill: SIGNPOST_COLORS.labelBg, stroke: SIGNPOST_COLORS.labelBorder, strokeWidth: 1 },
    tvTextItems(v.l, toolText(d).faint ? faintColor(SIGNPOST_COLORS.labelText) : SIGNPOST_COLORS.labelText, d.style.bold, d.style.italic),
  );
  if (active) out.push({ t: "anchors", pts: [v.anchor], squares: SQUARE_ANCHORS.single });
  return out;
}

/** Price note (TV): a 2-point line; p0 carries a price bubble (the formatted
 *  price) + anchor dot; the user text rides along the line. */
export function scenePriceNote(d: Drawing, pts: Pt[], selected: boolean, s: DrawingStyle, coords: Coords | null): Scene {
  const [a, b] = pts;
  // TV price note renderer: 1px solid line in the line colour, a 2px dot at
  // P0 with a 1px ring in the pane colour (#0F0F0F dark), the P0 price label
  // at P1 (kinds/price-note.ts). Draw order: custom text, dot, line, label,
  // ring.
  const pip = coords?.pipSize() ?? 0.01;
  const digits = Math.max(0, Math.min(8, Math.round(-Math.log10(pip))));
  const priceLabel = priceNoteLabel(d, pts, digits);
  // TV price note text (line-tool-price-note `_customLabelRenderer`): the
  // TV text box at the left end / right end / middle of the line, turned to
  // the line angle, no placeholder on the chart; factory tv-blue-500, 14px,
  // centre / bottom (box above the line). Middle cuts the line.
  const label = (() => {
    if (!d.text) return null;
    const l = a.x < b.x ? a : b;
    const r = l === a ? b : a;
    const horz = s.horzLabelsAlign ?? "center";
    const u = horz === "left" ? l : horz === "right" ? r : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const ang = Math.atan((r.y - l.y) / (r.x - l.x));
    return tvTextLayout({ x: u.x, y: u.y, text: d.text, fs: s.fontSize ?? 14, bold: s.bold, italic: s.italic, vert: s.vertLabelsAlign ?? "bottom", horz, angle: Number.isNaN(ang) ? 0 : ang });
  })();
  const cutPoly = label && (s.vertLabelsAlign ?? "bottom") === "middle" ? label.poly : null;
  const cut = cutPoly && cutPoly.length ? "text" : undefined;
  const out: Scene = [{ t: "hit", a, b, width: 12 }];
  if (label) out.push(tvTextItems(label, s.textColor ?? "#2962ff", s.bold, s.italic));
  out.push({ t: "circle", cx: a.x, cy: a.y, r: 2, fill: s.color });
  if (cut) out.push({ t: "clip", name: cut, polys: [cutPoly!] });
  out.push({ t: "line", a, b, stroke: s.color, strokeWidth: 1, cap: "round", clip: cut });
  if (priceLabel) {
    const box = priceLabel.box;
    out.push(
      { t: "rect", x: box.left, y: box.top, w: box.width, h: box.height, rx: 4, fill: s.priceLabelBackgroundColor ?? "#2962ff", stroke: s.priceLabelBorderColor ?? "#2962ff", strokeWidth: 1 },
      tvTextItems(priceLabel, s.priceLabelTextColor ?? "#ffffff", s.priceLabelBold, s.priceLabelItalic),
    );
  }
  out.push({ t: "circle", cx: a.x, cy: a.y, r: 2.5, fill: "none", stroke: "#0f0f0f", strokeWidth: 1, inert: true });
  if (selected) out.push({ t: "anchors", pts });
  return out;
}

/** TV callout: box centred at p1 with the pointer to p0 in its outline
 *  (kinds/text-tools.ts calloutPath), border = line width, background with
 *  its transparency, text 10px in; anchors at p0 (and the wrap handle at the
 *  right middle when wrapping). */
export function sceneCallout(d: Drawing, pts: Pt[], selected: boolean, s: DrawingStyle): Scene {
  const [anchor, balloon] = pts;
  const c = calloutLayout(d, balloon);
  const faint = toolText(d).faint;
  const textColor = s.textColor ?? "#ffffff";
  const out: Scene = [{
    t: "path", d: calloutPath(c, anchor, balloon), fill: applyOpacity(parseColor(s.backgroundColor ?? s.color).hex, 100 - (s.transparency ?? 50)),
    stroke: s.borderColor ?? s.color, strokeWidth: s.width, join: "round",
  }];
  c.lines.forEach((ln, k) => {
    out.push({
      t: "text", x: c.x + 10, y: c.y + 10 + k * c.fs + c.fs / 2, text: ln, baseline: "central", size: c.fs,
      weight: s.bold ? 700 : 400, fontStyle: s.italic ? "italic" : "normal", fill: faint ? faintColor(textColor) : textColor, pre: true,
    });
  });
  if (selected) out.push({ t: "anchors", pts: c.wrap != null ? [anchor, { x: balloon.x + c.wrap / 2 + 10, y: balloon.y }] : [anchor] });
  return out;
}

/** TV table (module 995743, renderer `de` + pane view `ue`): background,
 *  1px grid at every cell edge, cell texts (TextRenderer padding 8, offset 1,
 *  line height 1.3, top aligned; left / centre / right in the cell), the
 *  active cell's 2px tv-blue inner border, the hovered resize edge (7px
 *  tv-blue at 20%) and the 4 corner anchors. The cell being edited shows the
 *  editor instead of its text. `ui` = the host's table UI state when this
 *  table is selected, else null. */
export function sceneTable(d: Drawing, p: Pt, active: boolean, ui: TableUi | null): Scene {
  const L = tableLayout(d, p);
  const s = d.style;
  const w = L.right - L.left;
  const h = L.bottom - L.top;
  let grid = "";
  for (const y of L.ys) grid += `M${L.left} ${y}h${w}v${TABLE_BORDER}h${-w}Z`;
  for (const x of L.xs) grid += `M${x} ${L.top}h${TABLE_BORDER}v${h}h${-TABLE_BORDER}Z`;
  let activeBorder = "";
  if (ui?.cell && ui.cell[0] < L.ys.length - 1 && ui.cell[1] < L.xs.length - 1) {
    const [r, c] = ui.cell;
    const left = L.xs[c], right = L.xs[c + 1], top = L.ys[r], bottom = L.ys[r + 1];
    const b = TABLE_BORDER, a = TABLE_ACTIVE_LINE;
    const rects = [
      [left + b, top + b, right - left - b, a],
      [left + b, bottom - a, right - left - b, a],
      [left + b, top + b, a, bottom - top - b],
      [right - a, top + b, a, bottom - top - b],
    ];
    activeBorder = rects.map(([x, y, rw, rh]) => `M${x} ${y}h${rw}v${rh}h${-rw}Z`).join("");
  }
  let edgeBand = "";
  if (ui?.edge) {
    if (ui.edge.col != null && L.xs[ui.edge.col + 1] != null) edgeBand += `M${L.xs[ui.edge.col + 1] - 3} ${L.top}h7v${L.bottom - L.top}h-7Z`;
    if (ui.edge.row != null && L.ys[ui.edge.row + 1] != null) edgeBand += `M${L.left} ${L.ys[ui.edge.row + 1] - 3}h${L.right - L.left}v7h${-(L.right - L.left)}Z`;
  }
  const align = s.horzLabelsAlign ?? "left";
  const texts: SceneItem[] = [];
  L.cells.forEach((row, r) => {
    row.forEach((_, c) => {
      const lines = ui?.editing && ui.cell && ui.cell[0] === r && ui.cell[1] === c ? [] : L.lines[r]?.[c] ?? [];
      const left = L.xs[c], right = L.xs[c + 1];
      const x = align === "right" ? right - TABLE_BORDER - TABLE_PAD : align === "center" ? left + (right - left) / 2 : left + TABLE_BORDER + TABLE_PAD;
      const y0 = L.ys[r] + TABLE_BORDER + TABLE_PAD + L.fs / 2 + 0.05 * L.fs;
      lines.forEach((ln, k) => {
        texts.push({
          t: "text", x, y: y0 + k * L.fs * TABLE_LINE_HEIGHT, text: ln, anchor: align === "right" ? "end" : align === "center" ? "middle" : "start",
          baseline: "central", size: L.fs, fill: s.textColor ?? "#dbdbdb", pre: true,
        });
      });
    });
  });
  const out: Scene = [
    // hit surface reaching the edge tolerance past the right / bottom edges
    { t: "rect", x: L.left - 3, y: L.top - 3, w: w + 7, h: h + 7, fill: "transparent" },
    { t: "rect", x: L.left, y: L.top, w, h, fill: s.backgroundColor ?? "#0f0f0f" },
    { t: "path", d: grid, fill: s.color, crisp: true },
  ];
  if (activeBorder) out.push({ t: "path", d: activeBorder, fill: TABLE_ACTIVE_COLOR, crisp: true });
  out.push({ t: "group", inert: true, items: texts });
  if (edgeBand) out.push({ t: "path", d: edgeBand, fill: TABLE_EDGE_COLOR, inert: true });
  if (active) out.push({ t: "anchors", pts: tableAnchors(L) });
  return out;
}

/** TV image (line-tool-image): the picture at its css size centred on the
 *  point, drawn at (100 − transparency)% opacity, with 4 corner anchors
 *  inset 1px. Nothing until the file is loaded. */
export function sceneImage(d: Drawing, p: Pt, active: boolean): Scene {
  const b = imageBox(d, p);
  if (!b) return [];
  const out: Scene = [{
    t: "image", href: drawingImage(d.image?.name)?.url ?? "", x: b.left, y: b.top, w: b.right - b.left, h: b.bottom - b.top,
    stretch: true, opacity: (100 - (d.style.transparency ?? 0)) / 100,
  }];
  if (active) out.push({ t: "anchors", pts: imageAnchors(b) });
  return out;
}
