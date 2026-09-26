"""Phase 3.3 patch: table and image host hooks in src/runtime/manager.ts.
Run from the repo root: python docs/port-opentrader/patches/table_image_hooks.py"""
p = 'src/runtime/manager.ts'
s = open(p, encoding='utf8').read()

rep = [
    ('''import { drawingAxisLabels } from "../tv/kinds/axis-labels";''',
     '''import { drawingAxisLabels } from "../tv/kinds/axis-labels";
import { tableCanRemove, tableEdgeOf, tableInsert, tableLayout, tableRemove, tableWithText, type TableCellRef, type TableUi } from "../tv/kinds/table";
import { drawingImageFailed, imageInitialSize, onImagesChanged } from "../tv/kinds/images";'''),
    ('''  /** A drag / placement gesture ended (undo coalescing). */
  gestureEnd: () => void;
};''',
     '''  /** A drag / placement gesture ended (undo coalescing). */
  gestureEnd: () => void;
  /** A click on a cell of a selected table (TV in-place editing): the host
   *  opens its editor over `box` (pane coordinates) and calls
   *  setTableCellText; endTableEdit when it closes. */
  tableEdit: (d: Drawing, cell: TableCellRef, box: { left: number; top: number; width: number; height: number }) => void;
};

export type TableOp = "insert-column" | "insert-row" | "remove-row" | "remove-column";'''),
    ('''selection: new Set(), tool: new Set(), textEdit: new Set(), gestureEnd: new Set() };''',
     '''selection: new Set(), tool: new Set(), textEdit: new Set(), gestureEnd: new Set(), tableEdit: new Set() };'''),
    ('''  private gesture: Gesture | null = null;''',
     '''  private gesture: Gesture | null = null;
  /** TV table UI of the selected table: active cell, open editor, hovered
   *  resize edge. */
  private tableUi: TableUi | null = null;'''),
    ('''    this.listen(window, "blur", () => { this.shift = false; this.ctrl = false; });''',
     '''    this.listen(window, "blur", () => { this.shift = false; this.ctrl = false; });
    // Images load asynchronously (core image cache, filled by the host's
    // reader): redraw, and drop an image drawing whose file failed (TV).
    this.off.push(onImagesChanged(() => {
      for (const d of this.list) if (d.kind === "image" && drawingImageFailed(d.image?.name)) this.remove(d.id);
      this.redraw();
    }));'''),
    ('''  select(ids: readonly string[]): void {
    this.selected = ids.filter((id) => this.get(id));''',
     '''  select(ids: readonly string[]): void {
    this.selected = ids.filter((id) => this.get(id));
    if (this.tableUi && !this.selected.includes(this.tableUi.id)) this.tableUi = null;'''),
    ('''  /** The drawings as JSON (the core Drawing model). */''',
     '''  /** TV image: placed at the pane centre at its initial size (a quarter of
   *  the pane at most) and selected. The file must be known to the core
   *  image cache (cacheImage / setImageReader) under `name`. */
  addImage(img: { name: string; width: number; height: number; transparency?: number }): string | null {
    const { w, h } = this.paneSize();
    const dp = unproject(this.coords, { x: w / 2, y: h / 2 });
    if (!dp) return null;
    const style = defaultStyleFor("image");
    const id = this.add({
      kind: "image",
      points: [dp],
      image: { name: img.name, ...imageInitialSize(img.width, img.height, w, h) },
      style: { ...style, transparency: img.transparency ?? style.transparency },
    } as NewDrawing);
    this.select([id]);
    return id;
  }

  /** The table UI state (active cell, editor open, hovered edge) or null. */
  tableState(): TableUi | null {
    return this.tableUi;
  }
  setTableCellText(id: string, cell: TableCellRef, text: string): void {
    const d = this.get(id);
    if (d?.kind !== "table") return;
    this.update({ ...d, style: { ...d.style, ...tableWithText(d.style, cell, text) } } as Drawing);
  }
  /** The cell editor closed (the cell stays active). */
  endTableEdit(): void {
    if (this.tableUi) this.tableUi = { ...this.tableUi, editing: false };
    this.redraw();
  }
  /** TV table context actions on the active cell (insert after it, or at the
   *  end without one; remove its row / column). */
  tableOp(id: string, op: TableOp): void {
    const d = this.get(id);
    if (d?.kind !== "table") return;
    const cell = this.tableUi?.id === id ? this.tableUi.cell : null;
    if (op === "insert-column" || op === "insert-row") {
      this.update({ ...d, style: { ...d.style, ...tableInsert(d.style, op === "insert-row" ? "row" : "column", cell) } } as Drawing);
    } else {
      const kind = op === "remove-row" ? "row" : "column";
      if (!cell || !tableCanRemove(d.style, kind)) return;
      const r = tableRemove(d.style, kind, cell);
      this.update({ ...d, style: { ...d.style, ...r.patch } } as Drawing);
      this.tableUi = { id, cell: r.cell, editing: this.tableUi?.editing ?? false, edge: null };
    }
    this.emit("gestureEnd");
  }

  /** The drawings as JSON (the core Drawing model). */'''),
    ('''      const scene = sceneOf(d, pts, { w, h, coords: c, selected: active && !d.locked, hovered: hov, textSelected: sel });''',
     '''      const tableUi = d.kind === "table" && sel && this.tableUi?.id === d.id ? this.tableUi : null;
      const scene = sceneOf(d, pts, { w, h, coords: c, selected: active && !d.locked, hovered: hov, textSelected: sel, tableUi });'''),
    ('''    const hit = this.hitTopmost(sp);
    this.setHover(hit ? { id: hit.drawing.id, anchor: hit.mode.hit === "handle" ? hit.mode.handleIndex : -1 } : null);
    if (!hit) this.el.style.cursor = "";
    else if (hit.drawing.locked) this.el.style.cursor = "default";''',
     '''    const hit = this.hitTopmost(sp);
    this.setHover(hit ? { id: hit.drawing.id, anchor: hit.mode.hit === "handle" ? hit.mode.handleIndex : -1 } : null);
    // TV table: the hovered row / column edge of the selected table.
    const edge = hit?.drawing.kind === "table" && hit.mode.hit === "handle" ? tableEdgeOf(hit.mode.handleIndex) : null;
    const ui = this.tableUi;
    if (hit?.drawing.kind === "table" && this.selected.includes(hit.drawing.id)) {
      if ((ui?.edge?.row ?? -1) !== (edge?.row ?? -1) || (ui?.edge?.col ?? -1) !== (edge?.col ?? -1) || ui?.id !== hit.drawing.id) {
        this.tableUi = ui && ui.id === hit.drawing.id ? { ...ui, edge } : { id: hit.drawing.id, cell: null, editing: false, edge };
        this.redraw();
      }
    } else if (ui?.edge) {
      this.tableUi = { ...ui, edge: null };
      this.redraw();
    }
    if (!hit) this.el.style.cursor = "";
    else if (hit.drawing.locked) this.el.style.cursor = "default";
    else if (edge) this.el.style.cursor = edge.col != null && edge.row != null ? "default" : edge.col != null ? "ew-resize" : "ns-resize";'''),
    ('''      const g = this.gesture;
      if (g && !g.active) {
        if (g.pendingToggle) this.toggle(g.id);
        else if (g.pendingCollapse) this.select([g.id]);
      }''',
     '''      const g = this.gesture;
      if (g && !g.active) {
        if (g.pendingToggle) this.toggle(g.id);
        else if (g.pendingCollapse) this.select([g.id]);
        // TV table: a click on a cell of the already selected table makes it
        // the active cell and opens its editor; a corner anchor clears it.
        if (g.start.kind === "table" && !multiKey) {
          if (g.mode.hit === "body" && g.mode.cell && wasSelected) this.openCell(g.start, g.mode.cell);
          else if (g.mode.hit === "handle" && g.mode.handleIndex < 4 && this.tableUi?.id === g.id) {
            this.tableUi = { ...this.tableUi, cell: null, editing: false };
            this.redraw();
          }
        }
      }'''),
    ('''  private toggle(id: string): void {''',
     '''  private openCell(d: Drawing, cell: TableCellRef): void {
    this.tableUi = { id: d.id, cell, editing: true, edge: null };
    this.redraw();
    const pts = screenPoints(this.coords, d, this.paneSize());
    if (!pts) return;
    const L = tableLayout(d, pts[0]);
    const [r, c] = cell;
    this.emit("tableEdit", d, cell, { left: L.xs[c], top: L.ys[r], width: L.xs[c + 1] - L.xs[c], height: L.ys[r + 1] - L.ys[r] });
  }

  private toggle(id: string): void {'''),
]
for a, b in rep:
    assert s.count(a) == 1, a[:70]
    s = s.replace(a, b)
open(p, 'w', encoding='utf8', newline='\n').write(s)
print('patched')
