/*
 * Shapes and cycles as scenes (moved from OpenTrader DrawingsOverlay, port
 * phase 2): rectangle, rotated rectangle, circle, ellipse, triangle, arc,
 * curve, double curve, sector, cyclic lines, sine line, time cycles.
 */
import { bboxCorners, dashFor, fillStyle, HIT_TOLERANCE, type Pt } from "../_shared";
import type { Drawing, DrawingStyle } from "../types";
import { arcSamples, bezierSamples, cubicSamples, rectEdgeMidpoints, sineSamples } from "../kinds/hit-tests";
import { rectangleTextLayout } from "../kinds/rectangle-text";
import { rotatedRectCorners } from "../rotated-rect";
import type { Scene, SceneItem } from "./types";
import { textCrossesLine, tvTextItems } from "./text";
import { endArrowItems, SQUARE_ANCHORS } from "./lines";

/** Hover raises a fillable shape's fill slightly (TV affordance). */
const HOVER_FILL_DELTA = 0.06;

export function shapeFill(s: DrawingStyle, hovered: boolean): { fill: string; fillOpacity: number } {
  const f = fillStyle(s);
  if (hovered && f.fillOpacity > 0) {
    return { fill: f.fill, fillOpacity: Math.min(1, f.fillOpacity + HOVER_FILL_DELTA) };
  }
  return f;
}

/** Stored `text` centered inside a shape (TV: rectangle / circle / ellipse
 *  carry an editable text). */
export function shapeTextItems(d: Drawing, cx: number, cy: number, s: DrawingStyle): SceneItem[] {
  if (!d.text) return [];
  return [{
    t: "text",
    x: cx,
    y: cy,
    text: d.text,
    size: s.fontSize ?? 14,
    fill: s.textColor ?? s.color,
    anchor: "middle",
    baseline: "middle",
    weight: s.bold ? 700 : 400,
    fontStyle: s.italic ? "italic" : "normal",
    inert: true,
  }];
}

/** Endpoint arrowheads (TV `leftEnd`/`rightEnd`) for a sampled curve: the
 *  tip sits on the stored endpoint, opening back along the local tangent. */
export function curveEndArrowItems(base: Pt[], s: DrawingStyle): SceneItem[] {
  if (base.length < 2) return [];
  const out: SceneItem[] = [];
  if (s.leftEnd === 1) out.push(...endArrowItems(base[1], base[0], s));
  if (s.rightEnd === 1) out.push(...endArrowItems(base[base.length - 2], base[base.length - 1], s));
  return out;
}

const pathOf = (pts: Pt[]) => pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

const anchorsIf = (selected: boolean, pts: Pt[], squares?: readonly number[]): SceneItem[] =>
  selected ? [squares ? { t: "anchors", pts, squares } : { t: "anchors", pts }] : [];

export function sceneRectangle(d: Drawing, pts: Pt[], selected: boolean, w: number, s: DrawingStyle, hovered: boolean): Scene {
  const [a, b] = pts;
  // TV extend: the box (fill, border, middle line) runs from −lineWidth /
  // to pane width + lineWidth on the extended side.
  const left = s.extendLeft ? -s.width : Math.min(a.x, b.x);
  const right = s.extendRight ? w + s.width : Math.max(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const bottom = Math.max(a.y, b.y);
  const f = shapeFill(s, hovered);
  // TV rectangle text (kinds/rectangle-text.ts). The middle line (TV
  // fillRectWithBorder: after the fill, before the border, at floor of the
  // box middle, butt caps) is cut behind a Middle ("Inside") text when the
  // text crosses it.
  const label = rectangleTextLayout(d, pts, w);
  const ml = s.rectMiddleLine;
  const out: Scene = [{
    t: "rect", x: left, y: top, w: right - left, h: bottom - top,
    fill: f.fill, fillOpacity: f.fillOpacity, stroke: s.color, strokeWidth: s.width, dash: dashFor(s),
  }];
  if (ml?.visible) {
    const cutPoly = label && (s.vertLabelsAlign ?? "middle") === "middle" && textCrossesLine(label.lines) ? label.poly : null;
    const cut = cutPoly && cutPoly.length ? "mid" : undefined;
    if (cut) out.push({ t: "clip", name: cut, polys: [cutPoly!] });
    const midY = Math.floor((top + bottom) / 2);
    out.push({
      t: "line", a: { x: left, y: midY }, b: { x: right, y: midY },
      stroke: ml.color, strokeWidth: ml.width, dash: dashFor({ ...s, lineStyle: ml.style, width: ml.width }),
      cap: "butt", clip: cut, inert: true,
    });
  }
  if (label) out.push(tvTextItems(label, s.textColor ?? s.color, s.bold, s.italic));
  // TV rectangles: 8 anchors — 4 corners + 4 edge midpoints (each midpoint
  // drags only its edge).
  out.push(...anchorsIf(selected, [...bboxCorners(a, b), ...rectEdgeMidpoints(a, b)], SQUARE_ANCHORS.rectangle));
  return out;
}

export function sceneRotatedRectangle(d: Drawing, pts: Pt[], selected: boolean, s: DrawingStyle): Scene {
  const fmt2 = d.fmt === 2;
  const corners = rotatedRectCorners(pts, fmt2);
  const f = fillStyle(s);
  // TV anchors: p0, p1 and the 4 corners (every corner drives the width).
  const anchors = fmt2 ? [pts[0], pts[1], ...corners] : pts;
  return [
    { t: "polygon", pts: corners, fill: f.fill, fillOpacity: f.fillOpacity, stroke: s.color, strokeWidth: s.width, dash: dashFor(s), join: "round" },
    ...anchorsIf(selected, anchors),
  ];
}

export function sceneCircle(d: Drawing, pts: Pt[], selected: boolean, s: DrawingStyle, hovered: boolean): Scene {
  const [c, e] = pts;
  const r = Math.hypot(e.x - c.x, e.y - c.y);
  const f = shapeFill(s, hovered);
  return [
    { t: "circle", cx: c.x, cy: c.y, r: Math.max(0, r), fill: f.fill, fillOpacity: f.fillOpacity, stroke: s.color, strokeWidth: s.width, dash: dashFor(s) },
    ...shapeTextItems(d, c.x, c.y, s),
    ...anchorsIf(selected, pts),
  ];
}

export function sceneEllipse(d: Drawing, pts: Pt[], selected: boolean, s: DrawingStyle, hovered: boolean): Scene {
  const [a, b, c] = pts;
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const rx = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y) / 2);
  const angRad = Math.atan2(b.y - a.y, b.x - a.x);
  // Perpendicular distance of p2 from the axis line = the half-height.
  const nx = -Math.sin(angRad);
  const ny = Math.cos(angRad);
  const ry = Math.max(1, Math.abs((c.x - cx) * nx + (c.y - cy) * ny));
  const deg = (angRad * 180) / Math.PI;
  const f = shapeFill(s, hovered);
  return [
    {
      t: "group",
      transform: `rotate(${deg} ${cx} ${cy})`,
      items: [
        { t: "ellipse", cx, cy, rx, ry, fill: "transparent", stroke: "transparent", strokeWidth: HIT_TOLERANCE * 2 },
        { t: "ellipse", cx, cy, rx, ry, fill: f.fill, fillOpacity: f.fillOpacity, stroke: s.color, strokeWidth: s.width, dash: dashFor(s) },
      ],
    },
    ...shapeTextItems(d, cx, cy, s),
    ...anchorsIf(selected, pts),
  ];
}

export function sceneTriangle(pts: Pt[], selected: boolean, s: DrawingStyle, hovered: boolean): Scene {
  const f = shapeFill(s, hovered);
  return [
    { t: "polygon", pts, fill: f.fill, fillOpacity: f.fillOpacity, stroke: s.color, strokeWidth: s.width, dash: dashFor(s), join: "round" },
    ...anchorsIf(selected, pts),
  ];
}

/** Arc through three points: p0 / p1 are the chord ends, p2 sets the
 *  perpendicular distance from the chord (arcSamples); the region between the
 *  arc and the chord is filled. */
export function sceneArc(pts: Pt[], selected: boolean, s: DrawingStyle): Scene {
  const [a, b] = pts;
  const dash = dashFor(s);
  const samples = pts.length === 3 ? arcSamples(a, b, pts[2]) : null;
  if (!samples) {
    return [{ t: "line", a, b, stroke: s.color, strokeWidth: s.width, dash, cap: "round" }, ...anchorsIf(selected, pts)];
  }
  const d = pathOf(samples);
  const f = fillStyle(s);
  return [
    // fill closes back to the chord start; only the arc itself is stroked
    { t: "path", d: `${d} Z`, fill: f.fill, fillOpacity: f.fillOpacity, stroke: "none" },
    { t: "path", d, fill: "none", stroke: s.color, strokeWidth: s.width, dash, cap: "round" },
    ...anchorsIf(selected, pts),
  ];
}

/** Sampled curve (fill to the chord, stroke, end arrows) + the control
 *  guides when selected. `controls` = [end, control] pairs. */
function curveScene(pts: Pt[], selected: boolean, s: DrawingStyle, stroke: Pt[], base: Pt[], controls: [Pt, Pt][]): Scene {
  const out: Scene = [];
  if (s.fillBackground) {
    const f = fillStyle(s);
    out.push({ t: "path", d: pathOf(base) + " Z", fill: f.fill, fillOpacity: f.fillOpacity, stroke: "none" });
  }
  out.push({ t: "path", d: pathOf(stroke), fill: "none", stroke: s.color, strokeWidth: s.width, dash: dashFor(s), cap: "round" });
  out.push(...curveEndArrowItems(base, s));
  if (selected) {
    for (const [e, c] of controls) out.push({ t: "line", a: e, b: c, stroke: s.color, strokeOpacity: 0.3, dash: "3 3" });
    out.push({ t: "anchors", pts });
  }
  return out;
}

export function sceneCurve(pts: Pt[], selected: boolean, s: DrawingStyle): Scene {
  // Placement preview hands 2 points (the control is derived at commit) —
  // degrade to a straight chord via a midpoint control.
  const full: Pt[] = pts.length >= 3
    ? pts
    : [pts[0], { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }, pts[1]];
  const [a, ctrl, b] = full;
  const stroke = bezierSamples(full, !!s.extendLeft, !!s.extendRight);
  // Fill closes the UNEXTENDED curve back to its chord (TV fillBackground).
  const base = s.extendLeft || s.extendRight ? bezierSamples(full) : stroke;
  return curveScene(pts, selected, s, stroke, base, [[a, ctrl], [b, ctrl]]);
}

export function sceneDoubleCurve(pts: Pt[], selected: boolean, s: DrawingStyle): Scene {
  // Placement preview hands 2 points (controls derive at commit) — degrade to
  // a straight chord via controls at the thirds.
  const full: Pt[] = pts.length >= 4
    ? pts
    : [
        pts[0],
        { x: pts[0].x + (pts[1].x - pts[0].x) / 3, y: pts[0].y + (pts[1].y - pts[0].y) / 3 },
        { x: pts[0].x + ((pts[1].x - pts[0].x) * 2) / 3, y: pts[0].y + ((pts[1].y - pts[0].y) * 2) / 3 },
        pts[1],
      ];
  const [a, c1, c2, b] = full;
  const stroke = cubicSamples(full, !!s.extendLeft, !!s.extendRight);
  const base = s.extendLeft || s.extendRight ? cubicSamples(full) : stroke;
  return curveScene(pts, selected, s, stroke, base, [[a, c1], [b, c2]]);
}

/** TV sector: radial gradient wedge from p0 with radius |p0 p1|, from the
 *  p1 direction to the p2 direction (shortest way). */
export function sceneSector(pts: Pt[], selected: boolean, s: DrawingStyle): Scene {
  const [p0, p1, p2raw] = pts;
  const len1 = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  if (!p2raw || len1 < 1e-6) {
    return [{ t: "line", a: p0, b: p1, stroke: s.color, strokeWidth: s.width }, ...anchorsIf(selected, pts)];
  }
  const a1 = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  const a2 = Math.atan2(p2raw.y - p0.y, p2raw.x - p0.x);
  const p2 = { x: p0.x + Math.cos(a2) * len1, y: p0.y + Math.sin(a2) * len1 };
  let sweep = a2 - a1;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  while (sweep < -Math.PI) sweep += 2 * Math.PI;
  const arc: Pt[] = [];
  for (let i = 0; i <= 32; i++) {
    const ang = a1 + (sweep * i) / 32;
    arc.push({ x: p0.x + Math.cos(ang) * len1, y: p0.y + Math.sin(ang) * len1 });
  }
  const alpha = s.fillBackground === false ? 0 : Math.max(0, Math.min(1, (100 - (s.transparency ?? 80)) / 100));
  return [
    {
      t: "radialGradient", name: "sector", idPrefix: "sector-grad-", cx: p0.x, cy: p0.y, r: len1,
      stops: [
        { offset: 0, color: s.sectorColor1 ?? "#2962ff", opacity: alpha },
        { offset: 1, color: s.sectorColor2 ?? "#9c27b0", opacity: alpha },
      ],
    },
    { t: "polygon", pts: [p0, ...arc], fillRef: "sector", stroke: "none" },
    { t: "line", a: p0, b: p1, stroke: s.color, strokeWidth: s.width },
    { t: "line", a: p0, b: p2, stroke: s.color, strokeWidth: s.width },
    { t: "polyline", pts: arc, fill: "none", stroke: s.color, strokeWidth: s.width },
    ...anchorsIf(selected, pts),
  ];
}

/** TV cyclic lines: vertical lines every |p1 p2| bars from p1 to the pane
 *  edge, and the dashed anchor connector. */
export function sceneCyclicLines(pts: Pt[], selected: boolean, w: number, h: number, s: DrawingStyle): Scene {
  const [p1, p2] = pts;
  const unit = p2.x - p1.x;
  const dash = dashFor(s);
  // anchor connector (TV: #808080 dashed 1px between the two clicks)
  const out: Scene = [{ t: "line", a: p1, b: p2, stroke: "#808080", strokeWidth: 1, dash: "6 4" }];
  if (Math.abs(unit) >= 2) {
    for (let x = p1.x; unit > 0 ? x <= w + 2 : x >= -2; x += unit) {
      out.push({ t: "line", a: { x, y: 0 }, b: { x, y: h }, stroke: s.color, strokeWidth: s.width, dash });
    }
  }
  out.push(...anchorsIf(selected, pts));
  return out;
}

export function sceneSineLine(pts: Pt[], selected: boolean, w: number, s: DrawingStyle): Scene {
  const samples = sineSamples(pts[0], pts[1], w);
  const out: Scene = [];
  if (samples.length >= 2) out.push({ t: "polyline", pts: samples, fill: "none", stroke: s.color, strokeWidth: s.width, dash: dashFor(s) });
  out.push(...anchorsIf(selected, pts));
  return out;
}

/** TV time cycles: half circles of diameter |p1 p2| on the p1 level, repeated
 *  over the whole pane width. */
export function sceneTimeCycles(pts: Pt[], selected: boolean, w: number, s: DrawingStyle): Scene {
  const [p1, p2] = pts;
  const unit = Math.abs(p2.x - p1.x);
  const r = unit / 2;
  const dash = dashFor(s);
  const f = fillStyle(s);
  const baseY = p1.y;
  const out: Scene = [];
  if (unit >= 2) {
    const startX = Math.min(p1.x, p2.x);
    const k0 = Math.floor(-startX / unit) - 1;
    const k1 = Math.ceil((w - startX) / unit) + 1;
    for (let k = k0; k <= k1; k++) {
      const sx = startX + k * unit;
      if (f.fillOpacity > 0) {
        out.push({ t: "path", d: `M ${sx} ${baseY} A ${r} ${r} 0 0 1 ${sx + unit} ${baseY} Z`, fill: f.fill, fillOpacity: f.fillOpacity, stroke: "none", inert: true });
      }
      out.push({ t: "path", d: `M ${sx} ${baseY} A ${r} ${r} 0 0 1 ${sx + unit} ${baseY}`, fill: "none", stroke: s.color, strokeWidth: s.width, dash });
    }
  }
  out.push(...anchorsIf(selected, pts));
  return out;
}
