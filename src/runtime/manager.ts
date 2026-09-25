/*
 * DrawingManager — the library runtime (port phase 3.3): TradingView-style
 * drawing tools on a lightweight-charts chart, built on the shared core
 * (src/tv). One series primitive draws every drawing, the placement preview
 * and the anchors in one canvas pass (scene -> canvas); the pointer / key
 * gestures reproduce OpenTrader's overlay with the core interaction functions
 * (placement, magnet, Shift constraints, anchor / body drags, hit tests).
 *
 * The host keeps what is not drawing logic: undo stack, storage, settings
 * dialogs, inline text / table editors, toolbar, context menu. It listens to
 * the events and calls the methods.
 */
import type { IChartApi, ISeriesApi, ISeriesPrimitive, IPrimitivePaneRenderer, IPrimitivePaneView, SeriesAttachedParameter, SeriesType, Time } from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { HitResult, Pt } from "../tv/_shared";
import type { Coords, OHLC } from "../tv/coords";
import { isVisibleOnInterval, type DataPoint, type Drawing, type DrawingKind, type NewDrawing } from "../tv/types";
import { defaultStyleFor, findOverlaySpec, type OverlaySpec } from "../tv/specs";
import { hitTestKind } from "../tv/kinds/hit-tests";
import { signpostPositionFor } from "../tv/kinds/signpost";
import { sceneLockedAnchors, sceneOf } from "../tv/scene";
import type { Scene } from "../tv/scene/types";
import { parseDrawings } from "../tv/serialize";
import { DRAG_THRESHOLD, FREEHAND_SAMPLE_PX, MIN_DISTANCE_BETWEEN_POINTS } from "../tv/interact/constants";
import { magnetSnap, projectAll, projectPoint, screenPoints, snapAngle, translateDrawing, unproject } from "../tv/interact/project";
import { ANGLE_SNAP_3PT_KINDS, ANGLE_SNAP_KINDS, buildNewDrawing, finishPlacement, SEGMENT_PREVIEW_KINDS, snapGannSquare } from "../tv/interact/placement";
import { anchorCursor, applyDrag, type DragState } from "../tv/interact/drag";
import { makeCoords } from "./coords";
import { drawScene } from "./scene-canvas";

export type MagnetMode = "off" | "weak" | "strong";

export type DrawingManagerOptions = {
  /** The bars of the series (magnet, data-driven tools, positions). Default:
   *  the series data (OHLC series; line series use `value` for all four). */
  bars?: () => OHLC[];
  /** Chart font for the drawings' text. Default: the chart layout font. */
  fontFamily?: string;
  /** Magnet (TV weak / strong OHLC snap). Default "off". */
  magnet?: MagnetMode;
  /** Chart interval for the per-interval visibility of drawings (TV
   *  Visibility tab), e.g. "30", "1D". Unset = every drawing shown. */
  interval?: string;
  /** Time zone / intraday flag for dates in labels. Default UTC, intraday. */
  timeInfo?: () => { timeZone: string; intraday: boolean };
  /** Keep the tool armed after a placement (TV "Keep drawing"). */
  stayInDrawingMode?: boolean;
};

export type DrawingManagerEvents = {
  /** The drawing list changed (add / update / remove / import / clear). */
  change: (drawings: readonly Drawing[]) => void;
  add: (d: Drawing) => void;
  update: (d: Drawing, prev: Drawing) => void;
  remove: (d: Drawing) => void;
  selection: (ids: readonly string[]) => void;
  /** The armed tool changed (null = none). */
  tool: (kind: DrawingKind | null) => void;
  /** A text tool was placed (or double-clicked): the host opens its editor
   *  at `screen` (pane coordinates) and calls update with the text. */
  textEdit: (d: Drawing, screen: Pt) => void;
  /** A drag / placement gesture ended (undo coalescing). */
  gestureEnd: () => void;
};

type Listeners = { [K in keyof DrawingManagerEvents]: Set<DrawingManagerEvents[K]> };

/** Drag state of a pointer gesture on a drawing (the core DragState plus the
 *  gesture's selection bookkeeping). */
type Gesture = DragState & { canDrag: boolean };

const newId = () => `dw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export class DrawingManager {
  private readonly chart: IChartApi;
  private readonly series: ISeriesApi<SeriesType>;
  private readonly opts: DrawingManagerOptions;
  private readonly coords: Coords;
  private readonly primitive: DrawingsPrimitive;
  private readonly el: HTMLElement;
  private readonly listeners: Listeners = { change: new Set(), add: new Set(), update: new Set(), remove: new Set(), selection: new Set(), tool: new Set(), textEdit: new Set(), gestureEnd: new Set() };
  private list: Drawing[] = [];
  private selected: string[] = [];
  private hovered: { id: string; anchor: number } | null = null;
  private spec: OverlaySpec | null = null;
  private glyph: string | undefined;
  private pending: DataPoint[] = [];
  private cursor: Pt | null = null;
  private gesture: Gesture | null = null;
  private shift = false;
  private ctrl = false;
  private savedScroll: { handleScroll: unknown; handleScale: unknown } | null = null;
  private readonly off: (() => void)[] = [];

  constructor(chart: IChartApi, series: ISeriesApi<SeriesType>, opts: DrawingManagerOptions = {}) {
    this.chart = chart;
    this.series = series;
    this.opts = { magnet: "off", ...opts };
    const bars = opts.bars ?? (() => seriesBars(series));
    this.coords = makeCoords(chart, series, bars, () => [], opts.timeInfo);
    this.primitive = new DrawingsPrimitive(this);
    series.attachPrimitive(this.primitive as ISeriesPrimitive<Time>);
    this.el = chart.chartElement();
    this.listen(this.el, "pointerdown", (e) => this.onPointerDown(e as PointerEvent), true);
    this.listen(this.el, "pointermove", (e) => this.onHover(e as PointerEvent));
    this.listen(this.el, "pointerleave", () => this.setHover(null));
    this.listen(this.el, "dblclick", (e) => this.onDoubleClick(e as MouseEvent), true);
    this.listen(window, "keydown", (e) => this.onKey(e as KeyboardEvent));
    this.listen(window, "keyup", (e) => this.onKey(e as KeyboardEvent));
    this.listen(window, "blur", () => { this.shift = false; this.ctrl = false; });
  }

  // ── public API ────────────────────────────────────────────────────────────

  on<K extends keyof DrawingManagerEvents>(event: K, cb: DrawingManagerEvents[K]): () => void {
    (this.listeners[event] as Set<DrawingManagerEvents[K]>).add(cb);
    return () => (this.listeners[event] as Set<DrawingManagerEvents[K]>).delete(cb);
  }

  /** Arm a tool (a DrawingKind of the core specs) or disarm (null). `glyph`:
   *  the font-icon glyph to place. */
  setTool(kind: DrawingKind | null, o: { glyph?: string } = {}): void {
    const spec = kind ? findOverlaySpec(kind) ?? null : null;
    this.spec = spec;
    this.glyph = o.glyph;
    this.pending = [];
    this.cursor = null;
    this.el.style.cursor = spec ? "crosshair" : "";
    this.emit("tool", spec ? spec.kind : null);
    this.redraw();
  }
  tool(): DrawingKind | null {
    return this.spec?.kind ?? null;
  }
  setMagnet(mode: MagnetMode): void {
    this.opts.magnet = mode;
  }
  setInterval(interval: string | undefined): void {
    this.opts.interval = interval;
    this.redraw();
  }
  setStayInDrawingMode(on: boolean): void {
    this.opts.stayInDrawingMode = on;
  }

  drawings(): readonly Drawing[] {
    return this.list;
  }
  get(id: string): Drawing | undefined {
    return this.list.find((d) => d.id === id);
  }
  /** Add a drawing (default style of its kind when none); returns its id. */
  add(nd: NewDrawing | Drawing): string {
    const d = { id: newId(), style: defaultStyleFor(nd.kind), ...nd } as Drawing;
    this.list = [...this.list, d];
    this.emit("add", d);
    this.changed();
    return d.id;
  }
  update(d: Drawing): void {
    const prev = this.get(d.id);
    if (!prev) return;
    this.list = this.list.map((x) => (x.id === d.id ? d : x));
    this.emit("update", d, prev);
    this.changed();
  }
  remove(id: string): void {
    const d = this.get(id);
    if (!d) return;
    this.list = this.list.filter((x) => x.id !== id);
    if (this.selected.includes(id)) this.select(this.selected.filter((x) => x !== id));
    this.emit("remove", d);
    this.changed();
  }
  clear(): void {
    this.list = [];
    this.select([]);
    this.changed();
  }
  /** Z-order (TV Visual order): the list order is the draw order. */
  bringToFront(id: string): void {
    this.reorder(id, this.list.length - 1);
  }
  sendToBack(id: string): void {
    this.reorder(id, 0);
  }

  select(ids: readonly string[]): void {
    this.selected = ids.filter((id) => this.get(id));
    this.emit("selection", this.selected);
    this.redraw();
  }
  selection(): readonly string[] {
    return this.selected;
  }

  /** The drawings as JSON (the core Drawing model). */
  exportJSON(): string {
    return JSON.stringify(this.list);
  }
  /** Replace the drawings from JSON (string or parsed): entries are checked
   *  and migrated (core parseDrawings); returns how many were loaded. */
  importJSON(json: string | unknown): number {
    const parsed = typeof json === "string" ? JSON.parse(json) : json;
    this.list = parseDrawings(parsed);
    this.select([]);
    this.changed();
    return this.list.length;
  }

  /** Redraw on the next frame (the chart repaints the primitive). */
  redraw(): void {
    this.primitive.requestUpdate();
  }

  destroy(): void {
    this.endGesture();
    for (const f of this.off) f();
    this.series.detachPrimitive(this.primitive as ISeriesPrimitive<Time>);
  }

  // ── rendering (called by the primitive) ─────────────────────────────────

  /** Every visible drawing, then the placement preview, as scenes in pane
   *  coordinates, with the anchor state of their drawing (TV ring stroke 2
   *  when selected, the hovered anchor's halo). */
  scenes(w: number, h: number): { scene: Scene; selected: boolean; hoveredAnchor: number }[] {
    const out: { scene: Scene; selected: boolean; hoveredAnchor: number }[] = [];
    const c = this.coords;
    const pane = { w, h };
    for (const d of this.list) {
      if (!this.shown(d)) continue;
      const pts = screenPoints(c, d, pane);
      if (!pts) continue;
      const sel = this.selected.includes(d.id);
      const hov = this.hovered?.id === d.id && !d.locked;
      // TV shows a drawing's anchors on hover too; locked drawings and an
      // armed tool keep hover feedback off.
      const active = sel || (hov && !this.spec);
      const scene = sceneOf(d, pts, { w, h, coords: c, selected: active && !d.locked, hovered: hov, textSelected: sel });
      out.push({ scene, selected: sel, hoveredAnchor: hov ? this.hovered!.anchor : -1 });
      if (sel && d.locked) out.push({ scene: sceneLockedAnchors(pts, d.style.color), selected: sel, hoveredAnchor: -1 });
    }
    const p = this.previewScene(w, h);
    if (p) out.push({ scene: p, selected: false, hoveredAnchor: -1 });
    return out;
  }
  fontFamily(): string {
    return this.opts.fontFamily ?? this.chart.options().layout.fontFamily;
  }
  /** Chart background at a y (the anchor fill). */
  backgroundAt(y: number, h: number): string {
    const bg = this.chart.options().layout.background as { type?: string; color?: string; topColor?: string; bottomColor?: string };
    if (bg.type === "gradient" && bg.topColor && bg.bottomColor) return mixHex(bg.topColor, bg.bottomColor, h > 0 ? Math.max(0, Math.min(1, y / h)) : 0);
    return bg.color ?? "#ffffff";
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private listen(t: EventTarget, type: string, f: (e: Event) => void, capture = false): void {
    t.addEventListener(type, f, capture);
    this.off.push(() => t.removeEventListener(type, f, capture));
  }
  private emit<K extends keyof DrawingManagerEvents>(event: K, ...args: Parameters<DrawingManagerEvents[K]>): void {
    for (const cb of this.listeners[event]) (cb as (...a: unknown[]) => void)(...args);
  }
  private changed(): void {
    this.emit("change", this.list);
    this.redraw();
  }
  private reorder(id: string, to: number): void {
    const i = this.list.findIndex((d) => d.id === id);
    if (i < 0) return;
    const next = this.list.slice();
    const [d] = next.splice(i, 1);
    next.splice(Math.max(0, Math.min(next.length, to)), 0, d);
    this.list = next;
    this.changed();
  }
  private shown(d: Drawing): boolean {
    return !d.hidden && (this.opts.interval == null || isVisibleOnInterval(d.visibility, this.opts.interval));
  }
  private paneSize(): { w: number; h: number } {
    const idx = this.series.getPane().paneIndex();
    const s = this.chart.paneSize(idx);
    return { w: s.width, h: s.height };
  }
  /** Pointer position in pane coordinates. */
  private panePoint(e: MouseEvent): Pt {
    const paneEl = this.series.getPane().getHTMLElement();
    const r = (paneEl ?? this.el).getBoundingClientRect();
    const left = this.chart.priceScale("left").width();
    const chartLeft = this.el.getBoundingClientRect().left;
    return { x: e.clientX - chartLeft - left, y: e.clientY - r.top };
  }
  private magnet(): { enabled: boolean; mode: "weak" | "strong" } {
    const m = this.opts.magnet ?? "off";
    const mode = m === "strong" ? "strong" : "weak";
    // TV: Shift forces the magnet off; Ctrl / Cmd inverts it (off -> strong).
    if (this.shift) return { enabled: false, mode };
    if (this.ctrl) return { enabled: m === "off", mode: "strong" };
    return { enabled: m !== "off", mode };
  }
  private snapFn(): (p: DataPoint) => DataPoint {
    const m = this.magnet();
    const c = this.coords;
    return m.enabled ? (p) => magnetSnap(p, c, m.mode, false) ?? p : (p) => p;
  }
  private dataAt(p: Pt): DataPoint | null {
    const dp = unproject(this.coords, p);
    return dp ? this.snapFn()(dp) : null;
  }
  /** The magnet-snapped aim point of the preview (x and y lock onto the
   *  candle when the magnet engages). */
  private aimAt(cur: Pt): Pt {
    const m = this.magnet();
    if (!m.enabled) return cur;
    const dp = unproject(this.coords, cur);
    const snapped = dp ? magnetSnap(dp, this.coords, m.mode, false) : null;
    return (snapped && projectPoint(this.coords, snapped)) || cur;
  }

  private hitTopmost(sp: Pt): { drawing: Drawing; mode: HitResult; pts: Pt[] } | null {
    const { w, h } = this.paneSize();
    // Drawings are clipped to the pane (TV): nothing hits over the axes.
    if (sp.x < 0 || sp.x > w || sp.y < 0 || sp.y > h) return null;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i];
      if (!this.shown(d)) continue;
      const pts = screenPoints(this.coords, d, { w, h });
      if (!pts) continue;
      const r = hitTestKind(d, pts, sp, w, h, this.coords, this.selected.includes(d.id));
      if (r) return { drawing: d, mode: r, pts };
    }
    return null;
  }

  private setHover(h: { id: string; anchor: number } | null): void {
    if (this.hovered?.id === h?.id && this.hovered?.anchor === h?.anchor) return;
    this.hovered = h;
    this.redraw();
  }

  /** Take the pointer gesture from the chart: no pan / zoom until release. */
  private holdChart(): void {
    if (this.savedScroll) return;
    // options() returns live objects: copy them before switching off.
    const o = this.chart.options() as unknown as { handleScroll: unknown; handleScale: unknown };
    this.savedScroll = { handleScroll: structuredClone(o.handleScroll), handleScale: structuredClone(o.handleScale) };
    this.chart.applyOptions({ handleScroll: false, handleScale: false });
  }
  private releaseChart(): void {
    if (!this.savedScroll) return;
    this.chart.applyOptions(this.savedScroll as never);
    this.savedScroll = null;
  }

  private onKey(e: KeyboardEvent): void {
    const down = e.type === "keydown";
    if (e.key === "Shift") this.shift = down;
    else if (e.key === "Control" || e.key === "Meta") this.ctrl = down;
    if (!down) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (e.key === "Escape") {
      // TV cascade: pending points -> the armed tool -> the selection.
      if (this.pending.length) {
        this.pending = [];
        this.redraw();
      } else if (this.spec) this.setTool(null);
      else if (this.selected.length) this.select([]);
      else return;
      e.preventDefault();
    } else if ((e.key === "Delete" || e.key === "Backspace") && this.selected.length) {
      const ids = this.selected.filter((id) => !this.get(id)?.locked);
      if (!ids.length) return;
      for (const id of ids) this.remove(id);
      e.preventDefault();
    }
  }

  private onHover(e: PointerEvent): void {
    if (this.gesture || e.buttons) return;
    const sp = this.panePoint(e);
    if (this.spec) {
      this.cursor = sp;
      this.redraw();
      return;
    }
    const hit = this.hitTopmost(sp);
    this.setHover(hit ? { id: hit.drawing.id, anchor: hit.mode.hit === "handle" ? hit.mode.handleIndex : -1 } : null);
    if (!hit) this.el.style.cursor = "";
    else if (hit.drawing.locked) this.el.style.cursor = "default";
    else if (hit.mode.hit === "handle") this.el.style.cursor = anchorCursor(hit.pts[hit.mode.handleIndex] ?? sp, hit.pts);
    else this.el.style.cursor = this.selected.includes(hit.drawing.id) ? "move" : "pointer";
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    const sp = this.panePoint(e);
    const { w, h } = this.paneSize();
    if (sp.x < 0 || sp.x > w || sp.y < 0 || sp.y > h) return;
    if (this.spec) {
      e.stopPropagation();
      this.holdChart();
      if (this.spec.freehand) this.startFreehand(sp);
      else {
        this.placementClick(sp);
        window.addEventListener("pointerup", () => this.releaseChart(), { once: true });
      }
      return;
    }
    this.selectionDown(e, sp);
  }

  private onDoubleClick(e: MouseEvent): void {
    // Variable-length tools (polyline / path / ghost feed): a double-click
    // finishes the drawing.
    if (this.spec?.variableLength) {
      e.stopPropagation();
      this.finishVariable(false);
      return;
    }
    if (this.spec) return;
    const hit = this.hitTopmost(this.panePoint(e));
    if (hit && findOverlaySpec(hit.drawing.kind)?.textEditable) {
      e.stopPropagation();
      this.emit("textEdit", hit.drawing, textAnchor(hit.drawing, hit.pts));
    }
  }

  private placementClick(spRaw: Pt): void {
    const spec = this.spec!;
    // TV image: placed by the host (file dialog), not by a click.
    if (spec.kind === "image") return;
    let sp = spRaw;
    const pend = this.pending;
    const c = this.coords;
    // Shift: 45-degree steps from the first anchor (2-point line tools), from
    // the previous anchor (3-point tools), a square for bbox tools (TV).
    if (this.shift && pend.length === 1 && spec.pointCount === 2 && ANGLE_SNAP_KINDS.has(spec.kind)) {
      const o = projectPoint(c, pend[0]);
      if (o) sp = snapAngle(o, sp);
    }
    if (this.shift && pend.length >= 1 && ANGLE_SNAP_3PT_KINDS.has(spec.kind)) {
      const o = projectPoint(c, pend[pend.length - 1]);
      if (o) sp = snapAngle(o, sp);
    }
    if (this.shift && pend.length === 1 && spec.isBbox) {
      const o = projectPoint(c, pend[0]);
      if (o) {
        const dx = sp.x - o.x;
        const dy = sp.y - o.y;
        const m = Math.max(Math.abs(dx), Math.abs(dy));
        sp = { x: o.x + Math.sign(dx || 1) * m, y: o.y + Math.sign(dy || 1) * m };
      }
    }
    // Variable length (TV addPoint): a click on the last vertex finishes, on
    // the first vertex of a polyline closes it.
    if (spec.variableLength && pend.length >= 1) {
      const near = (v: DataPoint) => {
        const p = projectPoint(c, v);
        return !!p && Math.hypot(p.x - sp.x, p.y - sp.y) < MIN_DISTANCE_BETWEEN_POINTS;
      };
      if (near(pend[pend.length - 1])) {
        if (pend.length >= 2) this.finishVariable(false);
        return;
      }
      if (spec.kind === "polyline" && pend.length >= 2 && near(pend[0])) {
        this.finishVariable(true);
        return;
      }
    }
    const dp = this.dataAt(sp);
    if (!dp) return;
    const next = [...pend, dp];
    if (spec.variableLength || next.length < spec.pointCount) {
      this.pending = next;
      this.cursor = sp;
      this.redraw();
      return;
    }
    const { w, h } = this.paneSize();
    let placed = finishPlacement(spec.kind, next, c, { w, h }, { glyph: this.glyph });
    // TV signpost addPoint: the click height sets the label position.
    if (placed && spec.kind === "signpost") {
      placed = { ...placed, style: { ...defaultStyleFor("signpost"), signpostPosition: signpostPositionFor(c, next[0], h) } } as NewDrawing;
    }
    this.pending = [];
    this.cursor = null;
    if (placed) this.placeNew(placed, spec.textEditable ? sp : null);
    else this.afterPlacement();
  }

  private finishVariable(closed: boolean): void {
    const spec = this.spec;
    if (!spec?.variableLength || this.pending.length < 2) return;
    const { w, h } = this.paneSize();
    const placed = finishPlacement(spec.kind, this.pending, this.coords, { w, h }, { closed });
    this.pending = [];
    this.cursor = null;
    if (placed) this.placeNew(placed, null);
    else this.afterPlacement();
  }

  /** TV selects every new drawing once placed; text tools ask the host for
   *  their editor. */
  private placeNew(nd: NewDrawing, textAt: Pt | null): void {
    const id = this.add(nd);
    if (!this.opts.stayInDrawingMode) this.select([id]);
    const d = this.get(id);
    if (d && textAt) this.emit("textEdit", d, textAt);
    this.afterPlacement();
  }
  private afterPlacement(): void {
    this.emit("gestureEnd");
    if (!this.opts.stayInDrawingMode) this.setTool(null);
    else this.redraw();
  }

  /** Brush / highlighter: press, drag (a vertex every FREEHAND_SAMPLE_PX),
   *  release commits (no magnet, like TV). */
  private startFreehand(sp0: Pt): void {
    const spec = this.spec!;
    const dp0 = unproject(this.coords, sp0);
    if (!dp0) return;
    this.pending = [dp0];
    this.cursor = sp0;
    let last = sp0;
    const move = (ev: PointerEvent) => {
      const cur = this.panePoint(ev);
      this.cursor = cur;
      if (Math.hypot(cur.x - last.x, cur.y - last.y) < FREEHAND_SAMPLE_PX) return;
      const dp = unproject(this.coords, cur);
      if (!dp) return;
      last = cur;
      this.pending = [...this.pending, dp];
      this.redraw();
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      this.releaseChart();
      const pts = this.pending;
      this.pending = [];
      this.cursor = null;
      const placed = pts.length >= 2 ? buildNewDrawing(spec.kind, pts) : null;
      if (placed) this.placeNew(placed, null);
      else this.afterPlacement();
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  }

  private selectionDown(e: PointerEvent, sp: Pt): void {
    const hit = this.hitTopmost(sp);
    const multiKey = e.ctrlKey || e.metaKey;
    if (!hit) {
      // Ctrl+click on empty space keeps the selection (TV); a plain click
      // clears it and the chart pans as usual.
      if (!multiKey && this.selected.length) this.select([]);
      return;
    }
    e.stopPropagation();
    this.holdChart();
    const ids = this.selected;
    const wasSelected = ids.includes(hit.drawing.id);
    const inGroup = wasSelected && ids.length > 1;
    if (!multiKey && !wasSelected) this.select([hit.drawing.id]);
    // Locked drawings can join / leave the selection but never drag.
    if (hit.drawing.locked) {
      if (multiKey) this.toggle(hit.drawing.id);
      else if (inGroup) this.select([hit.drawing.id]);
      window.addEventListener("pointerup", () => this.releaseChart(), { once: true });
      return;
    }
    const pane = this.paneSize();
    const group =
      inGroup && hit.mode.hit === "body"
        ? ids
            .map((id) => this.get(id))
            .filter((d): d is Drawing => !!d && !d.locked && this.shown(d))
            .map((d) => ({ start: d, startScreen: screenPoints(this.coords, d, pane) }))
            .filter((m): m is { start: Drawing; startScreen: Pt[] } => !!m.startScreen)
        : undefined;
    // TV gates body drags on selection: a press on an unselected drawing's
    // body only selects it; anchor drags engage at once.
    this.gesture = {
      id: hit.drawing.id,
      start: hit.drawing,
      startCursor: sp,
      startScreen: hit.pts,
      mode: hit.mode,
      active: false,
      group,
      pendingToggle: multiKey,
      pendingCollapse: !multiKey && inGroup,
      pane,
      canDrag: hit.mode.hit === "handle" || wasSelected,
    };
    const move = (ev: PointerEvent) => this.dragMove(this.panePoint(ev));
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      const g = this.gesture;
      if (g && !g.active) {
        if (g.pendingToggle) this.toggle(g.id);
        else if (g.pendingCollapse) this.select([g.id]);
      }
      // TV image endChanging: the centre goes back to its bar.
      if (g?.active && g.start.kind === "image") {
        const cur = this.get(g.id);
        if (cur?.image?.dx != null) {
          const { dx: _dx, ...im } = cur.image;
          this.update({ ...cur, image: im } as Drawing);
        }
      }
      this.endGesture();
      this.emit("gestureEnd");
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  }

  private dragMove(cur: Pt): void {
    const g = this.gesture;
    if (!g) return;
    if (!g.active) {
      if (!g.canDrag) return;
      if (Math.hypot(cur.x - g.startCursor.x, cur.y - g.startCursor.y) < DRAG_THRESHOLD) return;
      // Ctrl + body drag of a single drawing clones it (TV): the copy stays,
      // the original moves.
      if (g.pendingToggle && g.mode.hit === "body" && !g.group) {
        const { id: _id, ...copy } = g.start;
        this.add(copy as NewDrawing);
        this.select([g.id]);
      }
      g.active = true;
      g.pendingToggle = false;
      g.pendingCollapse = false;
    }
    if (g.group) {
      const dx = cur.x - g.startCursor.x;
      const dy = cur.y - g.startCursor.y;
      for (const m of g.group) {
        const nd = translateDrawing(this.coords, m.start, m.startScreen, dx, dy, this.paneSize());
        if (nd) this.update(nd);
      }
      return;
    }
    const updated = applyDrag(g, cur, this.coords, this.snapFn(), this.shift);
    if (updated) this.update(updated);
  }

  private endGesture(): void {
    this.gesture = null;
    this.releaseChart();
  }

  private toggle(id: string): void {
    this.select(this.selected.includes(id) ? this.selected.filter((x) => x !== id) : [...this.selected, id]);
  }

  /** The live placement preview: the real tool with the cursor standing in
   *  for the unplaced points (TV), the real freehand stroke, or the segment
   *  rubber band (patterns, Elliott, variable-length tools). */
  private previewScene(w: number, h: number): Scene | null {
    const spec = this.spec;
    const p = this.pending;
    const raw = this.cursor;
    if (!spec || !p.length || !raw) return null;
    const c = this.coords;
    const placed = p.map((dp) => projectPoint(c, dp)).filter((x): x is Pt => !!x);
    if (!placed.length) return null;
    const style = defaultStyleFor(spec.kind);
    const cur = this.aimAt(raw);
    const dots: Scene = placed.map((pt) => ({ t: "circle", cx: pt.x, cy: pt.y, r: 3, fill: style.color }));
    if (!spec.variableLength && !spec.freehand && !SEGMENT_PREVIEW_KINDS.has(spec.kind) && placed.length === p.length && placed.length < spec.pointCount) {
      let end = cur;
      if (this.shift && ((placed.length === 1 && spec.pointCount === 2 && ANGLE_SNAP_KINDS.has(spec.kind)) || ANGLE_SNAP_3PT_KINDS.has(spec.kind))) {
        end = snapAngle(placed[placed.length - 1], cur);
      }
      const curData = this.dataAt(end);
      if (curData) {
        const full = [...p];
        while (full.length < spec.pointCount) full.push(curData);
        const nd0 = buildNewDrawing(spec.kind, full);
        const nd = nd0 && spec.kind === "gann-square" ? snapGannSquare(nd0, c) : nd0;
        const d = nd ? ({ ...nd, id: "__preview__", style } as Drawing) : null;
        const screen = d ? projectAll(c, d.points) : null;
        if (d && screen) return [...sceneOf(d, screen, { w, h, coords: c, selected: false }), ...dots];
      }
    }
    if (spec.freehand && placed.length >= 2) {
      return sceneOf({ id: "__preview__", kind: spec.kind, points: p, style } as Drawing, placed, { w, h, coords: c, selected: false });
    }
    const last = placed[placed.length - 1];
    const out: Scene = [];
    if (placed.length >= 2) out.push({ t: "polyline", pts: placed, fill: "none", stroke: style.color, strokeWidth: style.width, cap: "round" });
    out.push({ t: "line", a: last, b: cur, stroke: style.color, strokeWidth: style.width, cap: "round" });
    return [...out, ...dots];
  }
}

/** The editor anchor of a text drawing: the click point, the balloon centre
 *  (callout / note), the line middle (price note). */
function textAnchor(d: Drawing, pts: Pt[]): Pt {
  if ((d.kind === "callout" || d.kind === "note") && pts[1]) return pts[1];
  if (d.kind === "price-note" && pts[1]) return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
  return pts[0];
}

/** OHLC bars of a series from its data (line / area data: value for all). */
function seriesBars(series: ISeriesApi<SeriesType>): OHLC[] {
  return series.data().map((b) => {
    const r = b as { time: Time; open?: number; high?: number; low?: number; close?: number; value?: number; volume?: number };
    const v = r.value ?? r.close ?? 0;
    return { time: r.time, open: r.open ?? v, high: r.high ?? v, low: r.low ?? v, close: r.close ?? v, volume: r.volume };
  }) as OHLC[];
}

function mixHex(a: string, b: string, t: number): string {
  const pa = /^#([0-9a-f]{6})$/i.exec(a);
  const pb = /^#([0-9a-f]{6})$/i.exec(b);
  if (!pa || !pb) return a;
  const na = parseInt(pa[1], 16);
  const nb = parseInt(pb[1], 16);
  const ch = (sh: number) => Math.round(((na >> sh) & 255) + (((nb >> sh) & 255) - ((na >> sh) & 255)) * t);
  return "#" + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0");
}

/** The series primitive: one pane view drawing every scene of the manager
 *  in the pane (clipped to it), above the series. */
class DrawingsPrimitive implements ISeriesPrimitive<Time> {
  private readonly m: DrawingManager;
  private request: (() => void) | null = null;
  private readonly view: IPrimitivePaneView;

  constructor(m: DrawingManager) {
    this.m = m;
    const renderer: IPrimitivePaneRenderer = { draw: (t) => this.draw(t) };
    this.view = { zOrder: () => "top", renderer: () => renderer };
  }
  attached(p: SeriesAttachedParameter<Time>): void {
    this.request = p.requestUpdate;
  }
  detached(): void {
    this.request = null;
  }
  paneViews(): readonly IPrimitivePaneView[] {
    return [this.view];
  }
  requestUpdate(): void {
    this.request?.();
  }
  private draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const w = mediaSize.width;
      const h = mediaSize.height;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.clip();
      const family = this.m.fontFamily();
      const fillAt = (y: number) => this.m.backgroundAt(y, h);
      const onAsyncLoad = () => this.requestUpdate();
      for (const s of this.m.scenes(w, h)) {
        drawScene(ctx, s.scene, { fontFamily: family, anchors: { fillAt, selected: s.selected, hovered: s.hoveredAnchor }, onAsyncLoad });
      }
      ctx.restore();
    });
  }
}
