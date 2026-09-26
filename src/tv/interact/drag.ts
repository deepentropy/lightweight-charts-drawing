/*
 * Anchor and body drags (moved from OpenTrader DrawingsOverlay, port phase 3):
 * the drag state, the per-kind anchor semantics (positions, channels, rotated
 * rectangle, table, image, signpost, text / callout wrap, rectangle edges,
 * bbox corners), the Shift constraints and the anchor resize cursor.
 */
import type { Time } from "lightweight-charts";
import { bboxCorners, type HitResult, type Pt } from "../_shared";
import type { Coords } from "../coords";
import type { DataPoint, Drawing, DrawingStyle } from "../types";
import { findOverlaySpec } from "../specs";
import { positionLevels } from "../kinds/position";
import { signpostLayout, signpostPositionAtY } from "../kinds/signpost";
import { distributeSizes, tableColWidths, tableEdgeOf, tableMinColWidth, tableMinRowHeight, tableRowHeights } from "../kinds/table";
import { drawingImage, IMAGE_ANCHOR_DIRS } from "../kinds/images";
import { projectPoint, replaceDrawingPoints, screenAngleDeg, snapAngle, translateDrawing, unproject } from "./project";
import { ANGLE_SNAP_3PT_KINDS, ANGLE_SNAP_KINDS } from "./placement";
import { MIN_DISTANCE_BETWEEN_POINTS } from "./constants";

export type DragState = {
  id: string;
  start: Drawing;
  startCursor: Pt;
  /** Each stored point projected to screen at drag start (SVG-local). */
  startScreen: Pt[];
  mode: HitResult;
  active: boolean;
  /** Multi-select body drag: every selected drawing captured at drag start
   *  (the hit drawing included) — the whole group translates together. */
  group?: { start: Drawing; startScreen: Pt[] }[];
  /** Ctrl was held on a body press: a bare click (no drag) toggles selection
   *  membership on release; crossing the drag threshold clones instead. */
  pendingToggle?: boolean;
  /** Plain click on a member of a multi-selection: a bare click collapses the
   *  selection to just that drawing on release (a drag moves the group). */
  pendingCollapse?: boolean;
  /** Pane size at drag start (anchored drawings store pane fractions). */
  pane?: { w: number; h: number };
};

export function applyPositionDrag(
  state: DragState,
  cursor: Pt,
  coords: Coords,
  snap: (p: DataPoint) => DataPoint,
): Drawing | null {
  const d = state.start;
  if (d.kind !== "long-position" && d.kind !== "short-position") return null;
  if (state.mode.hit !== "handle") return null;
  const idx = state.mode.handleIndex;
  const [p0, p1] = d.points;
  const pip = coords.pipSize();
  const sign = d.kind === "long-position" ? 1 : -1;
  const { stop, profit } = positionLevels(d, pip);
  if (idx === 0) {
    // Entry: free move; the close point's price stays locked to the entry.
    const m = unproject(coords, cursor);
    if (!m) return null;
    const sm = snap(m);
    return replaceDrawingPoints(d, [sm, { time: p1.time, price: sm.price }]);
  }
  if (idx === 1) {
    // Close point: horizontal-only.
    const t = coords.xToTime(cursor.x);
    if (t == null) return null;
    return replaceDrawingPoints(d, [p0, { time: t, price: p0.price }]);
  }
  const price = coords.yToPrice(cursor.y);
  if (price == null) return null;
  if (idx === 2) {
    const lvl = Math.max(pip, (p0.price - price) * sign);
    return { ...d, style: { ...d.style, stopLevel: lvl, profitLevel: profit } } as Drawing;
  }
  if (idx === 3) {
    const lvl = Math.max(pip, (price - p0.price) * sign);
    return { ...d, style: { ...d.style, profitLevel: lvl, stopLevel: stop } } as Drawing;
  }
  return null;
}

export function applyParallelChannelDrag(state: DragState, cursor: Pt, coords: Coords): Drawing | null {
  const d = state.start;
  if (d.kind !== "parallel-channel" || state.mode.hit !== "handle") return null;
  const [aS, bS, cS] = state.startScreen;
  if (!aS || !bS || !cS) return null;
  const idx = state.mode.handleIndex;
  const dx = cursor.x - state.startCursor.x;
  const dy = cursor.y - state.startCursor.y;
  const up = (p: Pt) => unproject(coords, p);
  const pts = d.points;
  if (idx === 0 || idx === 2) {
    // Main-edge start / offset-edge start: co-move p0 + p2 (TV preserves the
    // channel height on endpoint drags; height changes only via anchor 4).
    const p0n = up({ x: aS.x + dx, y: aS.y + dy });
    const p2n = up({ x: cS.x + dx, y: cS.y + dy });
    if (!p0n || !p2n) return null;
    return replaceDrawingPoints(d, [p0n, pts[1], p2n]);
  }
  if (idx === 1 || idx === 3) {
    // Main-edge end / offset-edge end: move p1 (height rides p0/p2).
    const p1n = up({ x: bS.x + dx, y: bS.y + dy });
    if (!p1n) return null;
    return replaceDrawingPoints(d, [pts[0], p1n, pts[2]]);
  }
  if (idx === 4) {
    // Offset-edge middle: height only (vertical p2 drag).
    const p2n = up({ x: cS.x, y: cS.y + dy });
    if (!p2n) return null;
    return replaceDrawingPoints(d, [pts[0], pts[1], p2n]);
  }
  if (idx === 5) {
    // Main-edge middle: shift the whole channel vertically.
    const p0n = up({ x: aS.x, y: aS.y + dy });
    const p1n = up({ x: bS.x, y: bS.y + dy });
    const p2n = up({ x: cS.x, y: cS.y + dy });
    if (!p0n || !p1n || !p2n) return null;
    return replaceDrawingPoints(d, [p0n, p1n, p2n]);
  }
  return null;
}

export function applyDisjointChannelDrag(
  state: DragState,
  cursor: Pt,
  coords: Coords,
  snap: (p: DataPoint) => DataPoint,
): Drawing | null {
  const d = state.start;
  if (d.kind !== "disjoint-channel" || state.mode.hit !== "handle") return null;
  const idx = state.mode.handleIndex;
  const pts = d.points;
  if (idx === 0 || idx === 1) {
    const m = unproject(coords, cursor);
    if (!m) return null;
    const next = pts.slice() as DataPoint[];
    next[idx] = snap(m);
    return replaceDrawingPoints(d, next);
  }
  const price = coords.yToPrice(cursor.y);
  if (price == null) return null;
  if (idx === 2) {
    // Offset-edge end at p1.x → p2's price directly.
    return replaceDrawingPoints(d, [pts[0], pts[1], { time: pts[2].time, price }]);
  }
  if (idx === 3) {
    // Offset-edge end at p0.x: its price = p2 + p1 − p0 (mirror), so the drag
    // adjusts p0's price — the mirrored edges stay coupled (TV model).
    const p0price = pts[2].price + pts[1].price - price;
    return replaceDrawingPoints(d, [{ time: pts[0].time, price: p0price }, pts[1], pts[2]]);
  }
  return null;
}

/** Rotated rectangle (fmt 2, TV): anchors 0/1 move the centre-line ends and
 *  keep the width (TV setPoint recomputes p2 = p0 + perp·distance); anchors
 *  2-5 are the corners and set p2 (the width) to the cursor. */
export function applyRotatedRectDrag(
  state: DragState,
  cursor: Pt,
  coords: Coords,
  snap: (p: DataPoint) => DataPoint,
): Drawing | null {
  const d = state.start;
  if (d.kind !== "rotated-rectangle" || state.mode.hit !== "handle") return null;
  const idx = state.mode.handleIndex;
  const m = unproject(coords, cursor);
  if (!m) return null;
  const pts = d.points.slice() as DataPoint[];
  if (idx >= 2) {
    pts[2] = m;
    return replaceDrawingPoints(d, pts);
  }
  const [a0, b0, c0] = state.startScreen;
  const ux = b0.x - a0.x;
  const uy = b0.y - a0.y;
  const ul = Math.hypot(ux, uy) || 1;
  const dist = Math.abs(((c0.x - a0.x) * uy - (c0.y - a0.y) * ux) / ul);
  const sm = snap(m);
  pts[idx] = sm;
  const a = idx === 0 ? projectPoint(coords, sm) : a0;
  const b = idx === 1 ? projectPoint(coords, sm) : b0;
  if (!a || !b) return null;
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const p2 = unproject(coords, { x: a.x + ((b.y - a.y) / len) * dist, y: a.y - ((b.x - a.x) / len) * dist });
  if (!p2) return null;
  pts[2] = p2;
  return replaceDrawingPoints(d, pts);
}

/** Given the current cursor + drag state, compute the updated drawing.
 *  `snap` is the price-axis snap fn used when magnet is on; pass the
 *  identity function (`(p) => p`) when off. */
export function applyDrag(
  state: DragState,
  cursor: Pt,
  coords: Coords,
  snap: (p: DataPoint) => DataPoint,
  constrain = false,
): Drawing | null {
  const spec = findOverlaySpec(state.start.kind);
  // Shift constraint on ANCHOR drags (TV): 2-point line kinds snap the dragged
  // endpoint to 45° steps around the fixed one; bbox kinds constrain to a
  // square around the opposite corner.
  if (constrain && state.mode.hit === "handle") {
    if (
      ANGLE_SNAP_KINDS.has(state.start.kind) &&
      state.startScreen.length === 2 &&
      state.mode.handleIndex >= 0 && state.mode.handleIndex <= 1 &&
      // circle: only the RADIUS point (index 1) snaps around the center —
      // TV never constrains the center drag.
      (state.start.kind !== "circle" || state.mode.handleIndex === 1)
    ) {
      const other = state.startScreen[1 - state.mode.handleIndex];
      if (other) cursor = snapAngle(other, cursor);
    } else if (spec?.isBbox && state.startScreen.length === 2 && state.mode.handleIndex < 4) {
      const cs = bboxCorners(state.startScreen[0], state.startScreen[1]);
      const opp = cs[(state.mode.handleIndex + 2) % 4];
      if (opp) {
        const dx = cursor.x - opp.x;
        const dy = cursor.y - opp.y;
        const m = Math.max(Math.abs(dx), Math.abs(dy));
        cursor = { x: opp.x + Math.sign(dx || 1) * m, y: opp.y + Math.sign(dy || 1) * m };
      }
    } else if (
      ANGLE_SNAP_3PT_KINDS.has(state.start.kind) &&
      state.mode.handleIndex >= 0 && state.mode.handleIndex < state.startScreen.length
    ) {
      // 3-point kinds: the dragged point snaps 45° around the PREVIOUS point
      // (the next one for the first anchor).
      const i = state.mode.handleIndex;
      const ref = state.startScreen[i > 0 ? i - 1 : 1];
      if (ref) cursor = snapAngle(ref, cursor);
    }
  }
  // Kind-specific anchor semantics (virtual anchors beyond the stored points).
  if (state.mode.hit === "handle") {
    switch (state.start.kind) {
      case "long-position":
      case "short-position":
        return applyPositionDrag(state, cursor, coords, snap);
      case "parallel-channel":
        return applyParallelChannelDrag(state, cursor, coords);
      case "table":
        return applyTableDrag(state, cursor, coords);
      case "signpost": {
        const paneH = state.pane?.h ?? 0;
        const pos = signpostPositionAtY(state.start, coords, paneH, cursor.y);
        if (pos == null) return null;
        return { ...state.start, style: { ...state.start.style, signpostPosition: pos } } as Drawing;
      }
      // TV text: anchor 1 = the wrap width (min 100), from the point.
      case "text": {
        if (state.mode.handleIndex !== 1) break;
        const fs = state.start.style.fontSize ?? 14;
        return { ...state.start, style: { ...state.start.style, wordWrapWidth: Math.max(100, cursor.x - state.startScreen[0].x - Math.floor(fs / 6)) } } as Drawing;
      }
      // TV callout: anchor 1 = the wrap width (min 100) with the box's left
      // edge kept; the balloon centre follows.
      case "callout": {
        if (state.mode.handleIndex !== 1) break;
        const st = state.start.style;
        const wrap0 = st.wordWrapWidth ?? 200;
        const leftEdge = state.startScreen[1].x - wrap0 / 2 - 10;
        const wrap = Math.max(100, cursor.x - leftEdge - 10);
        const m = unproject(coords, { x: leftEdge + wrap / 2 + 10, y: state.startScreen[1].y });
        if (!m) return null;
        return { ...replaceDrawingPoints(state.start, [state.start.points[0], m]), style: { ...st, wordWrapWidth: wrap } } as Drawing;
      }
      case "image":
        return applyImageDrag(state, cursor, coords);
      // Anchored pin (TV Anchor drawing): its one anchor moves the fixed pane
      // position like a body move (TV refuses point changes of a fixed
      // drawing; the pin has a single point).
      case "pin":
        if (state.start.anchored) return translateDrawing(coords, state.start, state.startScreen, cursor.x - state.startCursor.x, cursor.y - state.startCursor.y, state.pane);
        break;
      case "polyline": {
        // TV LineToolPolyline.setPoint: an end point dragged within
        // minDistanceBetweenPoints of the other end closes the polyline
        // (`filled`); the point stays where it is dropped.
        const i = state.mode.handleIndex;
        const n = state.startScreen.length;
        if (n > 2 && (i === 0 || i === n - 1)) {
          const other = state.startScreen[i === 0 ? n - 1 : 0];
          if (Math.hypot(cursor.x - other.x, cursor.y - other.y) < MIN_DISTANCE_BETWEEN_POINTS) {
            const m = unproject(coords, cursor);
            if (!m) return null;
            const next = state.start.points.slice() as DataPoint[];
            next[i] = snap(m);
            return { ...replaceDrawingPoints(state.start, next), closed: true } as Drawing;
          }
        }
        break;
      }
      case "disjoint-channel":
        return applyDisjointChannelDrag(state, cursor, coords, snap);
      case "rotated-rectangle":
        if (state.start.fmt === 2) return applyRotatedRectDrag(state, cursor, coords, snap);
        break;
      // TV: the h-line anchor is a vertical resize (price only), the v-line
      // anchor a horizontal resize (time only).
      case "horizontal-line": {
        const m = unproject(coords, cursor);
        if (!m) return null;
        return replaceDrawingPoints(state.start, [{ time: state.start.points[0].time, price: snap(m).price }]);
      }
      case "vertical-line": {
        const m = unproject(coords, cursor);
        if (!m) return null;
        return replaceDrawingPoints(state.start, [{ time: snap(m).time, price: state.start.points[0].price }]);
      }
    }
  }
  // Body drag: translate every stored point by the screen-delta, then
  // unproject. Body drags don't snap — snapping every point individually
  // would tear the shape apart on a single drag gesture.
  // TV signpost body move: the bar follows x, the position follows the
  // label's y.
  if (state.mode.hit === "body" && state.start.kind === "signpost") {
    const dx = cursor.x - state.startCursor.x;
    const dy = cursor.y - state.startCursor.y;
    const m = unproject(coords, { x: state.startScreen[0].x + dx, y: state.startScreen[0].y });
    const paneH = state.pane?.h ?? 0;
    const g0 = signpostLayout(state.start, state.startScreen[0], coords, paneH);
    if (!m) return null;
    const moved = replaceDrawingPoints(state.start, [{ time: m.time, price: state.start.points[0].price }]);
    const pos = signpostPositionAtY(moved, coords, paneH, g0.anchor.y + dy);
    return pos == null ? moved : ({ ...moved, style: { ...moved.style, signpostPosition: pos } } as Drawing);
  }
  if (state.mode.hit === "body") {
    return translateDrawing(coords, state.start, state.startScreen, cursor.x - state.startCursor.x, cursor.y - state.startCursor.y, state.pane);
  }
  // Rectangle edge-midpoint anchors (indices 4-7 = top/right/bottom/left):
  // drag only that edge; the opposite edge and both cross-axis edges stay put.
  if (state.start.kind === "rectangle" && state.mode.handleIndex >= 4 && state.startScreen.length === 2) {
    const [tl, , br] = bboxCorners(state.startScreen[0], state.startScreen[1]);
    let { x: left, y: top } = tl;
    let { x: right, y: bottom } = br;
    switch (state.mode.handleIndex) {
      case 4: top = cursor.y; break;
      case 5: right = cursor.x; break;
      case 6: bottom = cursor.y; break;
      case 7: left = cursor.x; break;
    }
    const a = unproject(coords, { x: left, y: top });
    const b = unproject(coords, { x: right, y: bottom });
    if (!a || !b) return null;
    return replaceDrawingPoints(state.start, [a, b]);
  }
  // Handle drag for bbox kinds: opposite-diagonal corner stays fixed.
  if (spec?.isBbox && state.startScreen.length === 2 && state.mode.handleIndex < 4) {
    const cs = bboxCorners(state.startScreen[0], state.startScreen[1]);
    const opposite = cs[(state.mode.handleIndex + 2) % 4];
    const a = unproject(coords, cursor);
    const b = unproject(coords, opposite);
    if (!a || !b) return null;
    return replaceDrawingPoints(state.start, [snap(a), b]);
  }
  // Handle drag for line / triangle / 1-point kinds: cursor → that point.
  const moved = unproject(coords, cursor);
  if (!moved) return null;
  const idx = state.mode.handleIndex;
  const next = state.start.points.slice() as DataPoint[];
  if (idx < 0 || idx >= next.length) return null;
  next[idx] = snap(moved);
  const updated = replaceDrawingPoints(state.start, next);
  // Trend-angle: re-freeze the screen-space angle from the dragged geometry
  // (the only edit that changes the readout — zooming never does).
  if (updated.kind === "trend-angle" && state.startScreen.length === 2 && idx <= 1) {
    const aS = idx === 0 ? cursor : state.startScreen[0];
    const bS = idx === 1 ? cursor : state.startScreen[1];
    return { ...updated, style: { ...updated.style, angle: screenAngleDeg(aS, bS) } };
  }
  return updated;
}

/** Time of the bar at or left of screen x (TV Math.floor(coordinateToFloatIndex)). */
export function floorTimeAt(coords: Coords, x: number): Time | null {
  const t = coords.xToTime(x);
  if (t == null) return null;
  const tx = coords.timeToX(t);
  if (tx == null || tx <= x + 1e-6) return t;
  const i = coords.timeToBarIndex(t);
  return i == null ? t : coords.barIndexToTime(i - 1) ?? t;
}

/** TV LineToolTable.setPoint. Corner anchors (0 TopLeft, 1 BottomLeft,
 *  2 TopRight, 3 BottomRight) resize the whole table from the opposite corner
 *  (sizes scaled with distributeSizes, kept at their minimum; a left corner
 *  snaps the point to the bar at or left of the cursor and the last column
 *  absorbs the rounding so the right edge stays). Edge anchors (≥ 1024)
 *  resize one column (≥ min width) or one row (≥ its text height). */
export function applyTableDrag(state: DragState, cursor: Pt, coords: Coords): Drawing | null {
  if (state.mode.hit !== "handle") return null;
  const d = state.start;
  const s = d.style;
  const i = state.mode.handleIndex;
  const p0 = state.startScreen[0];
  const fs = s.fontSize ?? 14;
  const widths = tableColWidths(s);
  const { heights, mins: rowMins } = tableRowHeights(s);
  const colMin = tableMinColWidth(fs);
  const colMins = widths.map(() => colMin);
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const totalW = sum(widths);
  const totalH = sum(heights);
  const edge = tableEdgeOf(i);
  if (edge) {
    const patch: Partial<DrawingStyle> = {};
    if (edge.col != null) {
      const left = p0.x + sum(widths.slice(0, edge.col));
      patch.tableColWidths = widths.map((w, k) => (k === edge.col ? Math.max(colMin, cursor.x - left) : w));
    }
    if (edge.row != null) {
      const top = p0.y + sum(heights.slice(0, edge.row));
      patch.tableRowHeights = heights.map((h, k) => (k === edge.row ? Math.max(rowMins[k], cursor.y - top) : h));
    }
    return { ...d, style: { ...s, ...patch } } as Drawing;
  }
  if (i > 3) return null;
  const isLeft = i === 0 || i === 1;
  const isTop = i === 0 || i === 2;
  const start = { x: p0.x + (isLeft ? 0 : totalW), y: p0.y + (isTop ? 0 : totalH) };
  const opp = { x: start.x + (isLeft ? totalW : -totalW), y: start.y + (isTop ? totalH : -totalH) };
  const minW = colMin * widths.length;
  const minH = sum(rowMins);
  let x = isLeft ? Math.min(cursor.x, opp.x - minW) : Math.max(cursor.x, opp.x + minW);
  const y = isTop ? Math.min(cursor.y, opp.y - minH) : Math.max(cursor.y, opp.y + minH);
  let time = d.points[0].time;
  // Anchored (TV isFixed): the fixed point follows the corner, no bar snap.
  const fixed = d.anchored && state.pane && state.pane.w > 0 && state.pane.h > 0 ? state.pane : null;
  if (isLeft && !fixed) {
    const t = floorTimeAt(coords, x);
    const tx = t == null ? null : coords.timeToX(t);
    if (t == null || tx == null) return null;
    time = t;
    x = tx;
  }
  let price = d.points[0].price;
  if (isTop && !fixed) {
    const pr = coords.yToPrice(y);
    if (pr == null) return null;
    price = pr;
  }
  const dxW = start.x - x;
  const dyH = start.y - y;
  const w = distributeSizes(widths, colMins, isLeft ? totalW + dxW : totalW - dxW);
  if (isLeft) w[w.length - 1] += Math.round(p0.x + totalW) - x - sum(w);
  const h = distributeSizes(heights, rowMins, isTop ? totalH + dyH : totalH - dyH);
  const rowMin = tableMinRowHeight(fs);
  if (fixed) {
    const fx = isLeft ? x : p0.x;
    const fy = isTop ? y : p0.y;
    return {
      ...d,
      anchored: { x: fx / fixed.w, y: fy / fixed.h },
      style: { ...s, tableColWidths: w.map((v) => Math.max(v, colMin)), tableRowHeights: h.map((v) => Math.max(v, rowMin)) },
    } as Drawing;
  }
  return {
    ...d,
    points: [{ time, price }],
    style: { ...s, tableColWidths: w.map((v) => Math.max(v, colMin)), tableRowHeights: h.map((v) => Math.max(v, rowMin)) },
  } as Drawing;
}

/** TV LineToolImage.setPoint: a corner drag scales the image uniformly from
 *  the opposite corner (scale = max(|dx| / natural width, |dy| / natural
 *  height), sizes rounded). The centre point snaps to a bar; `dx` keeps the
 *  exact centre while dragging (TV dOffsetX). */
export function applyImageDrag(state: DragState, cursor: Pt, coords: Coords): Drawing | null {
  const d = state.start;
  const im = d.image;
  const nat = drawingImage(im?.name);
  if (!im || !nat || state.mode.hit !== "handle" || state.mode.handleIndex > 3) return null;
  const [sx, sy] = IMAGE_ANCHOR_DIRS[state.mode.handleIndex];
  const c0 = { x: state.startScreen[0].x + (im.dx ?? 0), y: state.startScreen[0].y };
  const opp = { x: c0.x - (sx * im.cssWidth) / 2, y: c0.y - (sy * im.cssHeight) / 2 };
  const k = Math.max(Math.abs(opp.x - cursor.x) / nat.width, Math.abs(opp.y - cursor.y) / nat.height);
  const w = Math.round(nat.width * k);
  const h = Math.round(nat.height * k);
  const c = { x: opp.x + (sx * w) / 2, y: opp.y + (sy * h) / 2 };
  const m = unproject(coords, c);
  if (!m) return null;
  const mx = coords.timeToX(m.time);
  return { ...d, points: [m], image: { ...im, cssWidth: w, cssHeight: h, dx: mx == null ? 0 : c.x - mx } } as Drawing;
}

/** Direction-aware resize cursor for an anchor: the angle from the drawing's
 *  centroid to the anchor picks ew/ns/nesw/nwse (TV's anchorResizeCursorType).
 *  Single-anchor drawings keep the grab cursor. */
export function anchorCursor(p: Pt, pts: Pt[]): string {
  if (pts.length < 2) return "grab";
  let cx = 0, cy = 0;
  for (const q of pts) { cx += q.x; cy += q.y; }
  cx /= pts.length; cy /= pts.length;
  const dx = p.x - cx, dy = p.y - cy;
  if (Math.hypot(dx, dy) < 1) return "grab";
  const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 180;
  if (deg < 22.5 || deg >= 157.5) return "ew-resize";
  if (deg < 67.5) return "nwse-resize";
  if (deg < 112.5) return "ns-resize";
  return "nesw-resize";
}
