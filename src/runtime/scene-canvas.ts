/*
 * Canvas renderer of the drawing scenes (src/tv/scene): every scene item to
 * CanvasRenderingContext2D calls, in CSS pixels (the caller scales the
 * context for the device pixel ratio). The semantics follow SVG, so a scene
 * drawn here matches the same scene drawn as SVG by a host (OpenTrader
 * scene-svg): default fill black, default stroke none, stroke width 1, butt
 * caps / miter joins, even-odd cut-out clips, text anchors / baselines,
 * collapsed white space unless `pre`, images kept in aspect unless
 * `stretch`.
 */
import type { Pt } from "../tv/_shared";
import { HANDLE_RADIUS } from "../tv/_shared";
import type { Paint, SceneItem, Shadow } from "../tv/scene/types";

/** TV anchor ring colour (colorsPalette "color-tv-blue-600"), the same for
 *  every drawing. */
export const TV_ANCHOR_COLOR = "#1e53e5";

export type AnchorStyle = {
  /** Chart background at a y (the anchor fill). */
  fillAt: (y: number) => string;
  /** The owner drawing is selected (TV: ring stroke 2, else 1). */
  selected: boolean;
  /** Index of the hovered anchor in its anchors item (TV 20% halo), or -1. */
  hovered?: number;
};

export type CanvasSceneOptions = {
  /** Font family of scene text without its own family (the chart font). */
  fontFamily: string;
  anchors: AnchorStyle;
  /** Called when an image / glyph used by the scene finishes loading (the
   *  caller redraws). */
  onAsyncLoad?: () => void;
};

type Ctx = CanvasRenderingContext2D;
type Named = { clips: Map<string, (ctx: Ctx) => void>; grads: Map<string, CanvasGradient> };

/** Draws `items` on `ctx` (current transform = CSS pixels). */
export function drawScene(ctx: Ctx, items: SceneItem[], o: CanvasSceneOptions): void {
  const named: Named = { clips: new Map(), grads: new Map() };
  for (const it of items) drawItem(ctx, it, o, named);
}

function drawItem(ctx: Ctx, it: SceneItem, o: CanvasSceneOptions, named: Named): void {
  switch (it.t) {
    case "clip": {
      // Cut-out: everything outside the polygons (even-odd with a huge rect).
      const polys = it.polys;
      named.clips.set(it.name, (c) => {
        const B = 1e5;
        const p = new Path2D();
        p.rect(-B, -B, 2 * B, 2 * B);
        for (const pl of polys) {
          if (!pl.length) continue;
          p.moveTo(pl[0].x, pl[0].y);
          for (let i = 1; i < pl.length; i++) p.lineTo(pl[i].x, pl[i].y);
          p.closePath();
        }
        c.clip(p, "evenodd");
      });
      return;
    }
    case "clipRect": {
      const { x, y, w, h } = it;
      named.clips.set(it.name, (c) => {
        const p = new Path2D();
        p.rect(x, y, w, h);
        c.clip(p);
      });
      return;
    }
    case "radialGradient": {
      const g = ctx.createRadialGradient(it.cx, it.cy, 0, it.cx, it.cy, it.r);
      for (const st of it.stops) g.addColorStop(st.offset, withAlpha(st.color, st.opacity));
      named.grads.set(it.name, g);
      return;
    }
    case "hit":
    case "hitPath":
      return;
    case "anchors":
      drawAnchors(ctx, it.pts, it.squares, o.anchors);
      return;
  }
  const clip = "clip" in it && it.clip ? named.clips.get(it.clip) : undefined;
  const needSave = !!clip || it.t === "group" || ("transform" in it && !!it.transform);
  if (needSave) ctx.save();
  if (clip) clip(ctx);
  switch (it.t) {
    case "line": {
      const p = new Path2D();
      p.moveTo(it.a.x, it.a.y);
      p.lineTo(it.b.x, it.b.y);
      paint(ctx, p, it, named, false);
      break;
    }
    case "polyline":
    case "polygon": {
      const p = new Path2D();
      it.pts.forEach((q, i) => (i === 0 ? p.moveTo(q.x, q.y) : p.lineTo(q.x, q.y)));
      if (it.t === "polygon" && it.pts.length) p.closePath();
      paint(ctx, p, it, named, true);
      break;
    }
    case "path": {
      if (it.transform) applyTransform(ctx, it.transform);
      paint(ctx, new Path2D(it.d), it, named, true);
      break;
    }
    case "rect": {
      if (it.w < 0 || it.h < 0) break;
      const p = new Path2D();
      const rx = Math.min(it.rx ?? it.ry ?? 0, it.w / 2);
      const ry = Math.min(it.ry ?? it.rx ?? 0, it.h / 2);
      if (rx > 0 || ry > 0) roundRect(p, it.x, it.y, it.w, it.h, rx, ry);
      else p.rect(it.x, it.y, it.w, it.h);
      paint(ctx, p, it, named, true);
      break;
    }
    case "circle": {
      if (it.r <= 0) break;
      const p = new Path2D();
      p.arc(it.cx, it.cy, it.r, 0, Math.PI * 2);
      paint(ctx, p, it, named, true);
      break;
    }
    case "ellipse": {
      if (it.transform) applyTransform(ctx, it.transform);
      if (it.rx <= 0 || it.ry <= 0) break;
      const p = new Path2D();
      p.ellipse(it.cx, it.cy, it.rx, it.ry, 0, 0, Math.PI * 2);
      paint(ctx, p, it, named, true);
      break;
    }
    case "text":
      drawText(ctx, it, o);
      break;
    case "image":
      drawImage(ctx, it, o);
      break;
    case "glyph":
      drawGlyph(ctx, it, o);
      break;
    case "group": {
      if (it.transform) applyTransform(ctx, it.transform);
      if (it.opacity != null && it.opacity < 1) {
        // SVG group opacity: the children composite as one layer, then the
        // layer is blended (overlapping children do not add up).
        const layer = groupLayer(ctx);
        if (layer) {
          for (const c of it.items) drawItem(layer, c, o, named);
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalAlpha *= it.opacity;
          ctx.drawImage(layer.canvas, 0, 0);
          ctx.restore();
          break;
        }
        ctx.globalAlpha *= it.opacity;
      }
      for (const c of it.items) drawItem(ctx, c, o, named);
      break;
    }
  }
  if (needSave) ctx.restore();
}

/** A cleared offscreen context the size of `ctx`'s canvas with the same
 *  transform and clip-free state (group opacity layers). */
function groupLayer(ctx: Ctx): Ctx | null {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  if (!w || !h) return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const l = c.getContext("2d");
  if (!l) return null;
  l.setTransform(ctx.getTransform());
  return l;
}

/** Fill then stroke a path with SVG paint rules (`closedFill`: the item
 *  fills by default, as SVG shapes do; a line never fills). */
function paint(ctx: Ctx, p: Path2D, it: Paint, named: Named, closedFill: boolean): void {
  const fill = it.fillRef ? named.grads.get(it.fillRef) ?? null : closedFill ? it.fill ?? "#000000" : null;
  const stroke = it.stroke;
  const shadow = it.shadow;
  if (fill && fill !== "none" && fill !== "transparent") {
    ctx.save();
    if (shadow) setShadow(ctx, shadow);
    ctx.globalAlpha *= it.fillOpacity ?? 1;
    ctx.fillStyle = fill;
    ctx.fill(p, it.fillRule === "evenodd" ? "evenodd" : "nonzero");
    ctx.restore();
  }
  if (stroke && stroke !== "none" && stroke !== "transparent") {
    const width = it.strokeWidth ?? 1;
    if (width <= 0) return;
    ctx.save();
    if (shadow && (!fill || fill === "none" || fill === "transparent")) setShadow(ctx, shadow);
    ctx.globalAlpha *= it.strokeOpacity ?? 1;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineCap = it.cap ?? "butt";
    ctx.lineJoin = it.join ?? "miter";
    ctx.setLineDash(dashArray(it.dash));
    ctx.stroke(p);
    ctx.restore();
  }
}

function setShadow(ctx: Ctx, s: Shadow): void {
  ctx.shadowOffsetX = s.dx;
  ctx.shadowOffsetY = s.dy;
  ctx.shadowBlur = s.blur;
  ctx.shadowColor = s.color;
}

function dashArray(d: string | undefined): number[] {
  if (!d || d === "none") return [];
  const v = d.split(/[\s,]+/).map(Number).filter((x) => Number.isFinite(x) && x >= 0);
  if (!v.length || v.every((x) => x === 0)) return [];
  return v.length % 2 ? [...v, ...v] : v;
}

function roundRect(p: Path2D, x: number, y: number, w: number, h: number, rx: number, ry: number): void {
  p.moveTo(x + rx, y);
  p.lineTo(x + w - rx, y);
  p.ellipse(x + w - rx, y + ry, rx, ry, 0, -Math.PI / 2, 0);
  p.lineTo(x + w, y + h - ry);
  p.ellipse(x + w - rx, y + h - ry, rx, ry, 0, 0, Math.PI / 2);
  p.lineTo(x + rx, y + h);
  p.ellipse(x + rx, y + h - ry, rx, ry, 0, Math.PI / 2, Math.PI);
  p.lineTo(x, y + ry);
  p.ellipse(x + rx, y + ry, rx, ry, 0, Math.PI, (3 * Math.PI) / 2);
  p.closePath();
}

/** SVG transform list: rotate(a [cx cy]), translate(x [y]), scale(x [y]),
 *  matrix(a b c d e f). */
function applyTransform(ctx: Ctx, t: string): void {
  const re = /(rotate|translate|scale|matrix)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const a = m[2].split(/[\s,]+/).filter(Boolean).map(Number);
    switch (m[1]) {
      case "rotate": {
        const r = ((a[0] ?? 0) * Math.PI) / 180;
        if (a.length >= 3) {
          ctx.translate(a[1], a[2]);
          ctx.rotate(r);
          ctx.translate(-a[1], -a[2]);
        } else ctx.rotate(r);
        break;
      }
      case "translate":
        ctx.translate(a[0] ?? 0, a[1] ?? 0);
        break;
      case "scale":
        ctx.scale(a[0] ?? 1, a[1] ?? a[0] ?? 1);
        break;
      case "matrix":
        ctx.transform(a[0], a[1], a[2], a[3], a[4], a[5]);
        break;
    }
  }
}

function drawText(ctx: Ctx, it: Extract<SceneItem, { t: "text" }>, o: CanvasSceneOptions): void {
  const text = it.pre ? it.text : it.text.replace(/\s+/g, " ").trim();
  if (!text) return;
  ctx.save();
  if (it.opacity != null) ctx.globalAlpha *= it.opacity;
  const weight = it.weight === "bold" ? 700 : it.weight ?? 400;
  ctx.font = `${it.fontStyle === "italic" ? "italic " : ""}${weight} ${it.size}px ${it.family ?? o.fontFamily}`;
  ctx.textAlign = it.anchor === "middle" ? "center" : it.anchor === "end" ? "right" : "left";
  let y = it.y;
  if (it.baseline === "central") {
    // SVG central baseline: the alphabetic baseline sits (font ascent −
    // descent) / 2 below y (measured against Chrome's SVG, 25/09/2026; canvas
    // "middle" is 1-2 px higher).
    ctx.textBaseline = "alphabetic";
    y += centralShift(ctx);
  } else {
    // canvas "middle" = SVG "middle" within 0.5 px, "hanging" identical.
    ctx.textBaseline = it.baseline === "middle" ? "middle" : it.baseline === "hanging" ? "hanging" : "alphabetic";
  }
  ctx.fillStyle = it.fill ?? "#000000";
  ctx.fillText(text, it.x, y);
  ctx.restore();
}

const centralShifts = new Map<string, number>();
/** Alphabetic baseline offset of the SVG central baseline for ctx.font. */
function centralShift(ctx: Ctx): number {
  let v = centralShifts.get(ctx.font);
  if (v == null) {
    const m = ctx.measureText("H");
    v = (m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2;
    centralShifts.set(ctx.font, v);
  }
  return v;
}

const images = new Map<string, HTMLImageElement>();
function loadImage(src: string, o: CanvasSceneOptions): HTMLImageElement | null {
  let im = images.get(src);
  if (!im) {
    im = new Image();
    im.onload = () => o.onAsyncLoad?.();
    im.src = src;
    images.set(src, im);
  }
  return im.complete && im.naturalWidth > 0 ? im : null;
}

function drawImage(ctx: Ctx, it: Extract<SceneItem, { t: "image" }>, o: CanvasSceneOptions): void {
  if (!it.href) return;
  const im = loadImage(it.href, o);
  if (!im) return;
  ctx.save();
  if (it.opacity != null) ctx.globalAlpha *= it.opacity;
  if (it.stretch) ctx.drawImage(im, it.x, it.y, it.w, it.h);
  else {
    // SVG preserveAspectRatio xMidYMid meet.
    const k = Math.min(it.w / im.naturalWidth, it.h / im.naturalHeight);
    const w = im.naturalWidth * k;
    const h = im.naturalHeight * k;
    ctx.drawImage(im, it.x + (it.w - w) / 2, it.y + (it.h - h) / 2, w, h);
  }
  ctx.restore();
}

/** Font-icon glyph: an emoji / character centred in the box (font size
 *  size − 4, as OpenTrader's host), or `<svg>` markup drawn as an image with
 *  currentColor = the glyph colour. */
function drawGlyph(ctx: Ctx, it: Extract<SceneItem, { t: "glyph" }>, o: CanvasSceneOptions): void {
  const g = it.glyph.trim();
  if (!g) return;
  if (g.startsWith("<svg")) {
    let svg = g.replace(/currentColor/g, it.color);
    if (!/xmlns=/.test(svg)) svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    const im = loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, o);
    if (im) ctx.drawImage(im, it.x, it.y, it.size, it.size);
    return;
  }
  ctx.save();
  ctx.font = `${it.size - 4}px ${o.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = it.color;
  ctx.fillText(g, it.x + it.size / 2, it.y + it.size / 2);
  ctx.restore();
}

/** TV line anchors (LineAnchorRenderer): radius 6, ring in tv-blue-600
 *  inside the radius, stroke 1 (2 when the drawing is selected), filled with
 *  the chart background; one-axis anchors are rounded squares (corner 3);
 *  the hovered anchor gets a 3px ring at 20% just outside. */
function drawAnchors(ctx: Ctx, pts: Pt[], squares: readonly number[] | undefined, a: AnchorStyle): void {
  const sw = a.selected ? 2 : 1;
  pts.forEach((p, i) => {
    const square = !!squares?.includes(i);
    ctx.save();
    if (a.hovered === i) {
      ctx.strokeStyle = withAlpha(TV_ANCHOR_COLOR, 0.2);
      ctx.lineWidth = 3;
      const ring = new Path2D();
      if (square) roundRect(ring, p.x - HANDLE_RADIUS - 1.5, p.y - HANDLE_RADIUS - 1.5, 2 * HANDLE_RADIUS + 3, 2 * HANDLE_RADIUS + 3, 4.5, 4.5);
      else ring.arc(p.x, p.y, HANDLE_RADIUS + 1.5, 0, Math.PI * 2);
      ctx.stroke(ring);
    }
    const body = new Path2D();
    if (square) {
      const s = 2 * HANDLE_RADIUS - sw;
      roundRect(body, p.x - HANDLE_RADIUS + sw / 2, p.y - HANDLE_RADIUS + sw / 2, s, s, 3, 3);
    } else body.arc(p.x, p.y, HANDLE_RADIUS - sw / 2, 0, Math.PI * 2);
    ctx.fillStyle = a.fillAt(p.y);
    ctx.fill(body);
    ctx.strokeStyle = TV_ANCHOR_COLOR;
    ctx.lineWidth = sw;
    ctx.stroke(body);
    ctx.restore();
  });
}

/** A colour with its alpha multiplied by `k` (hex #rgb / #rrggbb / rgb(a)). */
function withAlpha(c: string, k: number): string {
  if (k >= 1) return c;
  const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (h) {
    const s = h[1].length === 3 ? h[1].split("").map((x) => x + x).join("") : h[1];
    const n = parseInt(s, 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${k})`;
  }
  const r = /^rgba?\(([^)]*)\)$/i.exec(c);
  if (r) {
    const [R, G, B, A] = r[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return `rgba(${R}, ${G}, ${B}, ${(A ?? 1) * k})`;
  }
  return c;
}
