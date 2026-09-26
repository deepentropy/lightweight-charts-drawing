"""Phase 3.3 patch: the drawing cursor goes through the primitive's hitTest
(lightweight-charts sets the pane cursor from it; a style set on the chart
element is overwritten). Run from the repo root."""
p = 'src/runtime/manager.ts'
s = open(p, encoding='utf8').read()
rep = [
    ('''    this.el.style.cursor = spec ? "crosshair" : "";
''', ''),
    ('''    if (!hit) this.el.style.cursor = "";
    else if (hit.drawing.locked) this.el.style.cursor = "default";
    else if (edge) this.el.style.cursor = edge.col != null && edge.row != null ? "default" : edge.col != null ? "ew-resize" : "ns-resize";
    else if (hit.mode.hit === "handle") this.el.style.cursor = anchorCursor(hit.pts[hit.mode.handleIndex] ?? sp, hit.pts);
    else this.el.style.cursor = this.selected.includes(hit.drawing.id) ? "move" : "pointer";''',
     '''    this.hoverCursor = !hit
      ? null
      : hit.drawing.locked
        ? "default"
        : edge
          ? edge.col != null && edge.row != null ? "default" : edge.col != null ? "ew-resize" : "ns-resize"
          : hit.mode.hit === "handle"
            ? anchorCursor(hit.pts[hit.mode.handleIndex] ?? sp, hit.pts)
            : this.selected.includes(hit.drawing.id) ? "move" : "pointer";'''),
    ('''  private tableUi: TableUi | null = null;''',
     '''  private tableUi: TableUi | null = null;
  /** Cursor over the hovered drawing (TV: pointer, move when selected,
   *  resize cursors on anchors and table edges), null = the chart's own. */
  private hoverCursor: string | null = null;'''),
    ('''  fontFamily(): string {''',
     '''  /** The cursor at a pane point, for the primitive hitTest (lightweight-
   *  charts shows it): crosshair while a tool is armed, the hovered
   *  drawing's cursor, else null (the chart's own). */
  cursorAt(): string | null {
    if (this.spec) return "crosshair";
    if (this.gesture?.active) return this.gesture.mode.hit === "body" ? "move" : this.hoverCursor;
    return this.hoverCursor;
  }
  fontFamily(): string {'''),
    ('''  requestUpdate(): void {
    this.request?.();
  }''',
     '''  requestUpdate(): void {
    this.request?.();
  }
  /** lightweight-charts sets the pane cursor from this (the manager's hover
   *  state, updated on pointer move). */
  hitTest(): PrimitiveHoveredItem | null {
    const c = this.m.cursorAt();
    return c ? { cursorStyle: c, externalId: "lightweight-charts-drawing", zOrder: "top" } : null;
  }'''),
    ('''IPrimitivePaneRenderer, IPrimitivePaneView, SeriesAttachedParameter,''',
     '''IPrimitivePaneRenderer, IPrimitivePaneView, PrimitiveHoveredItem, SeriesAttachedParameter,'''),
]
for a, b in rep:
    assert s.count(a) == 1, a[:70]
    s = s.replace(a, b)
open(p, 'w', encoding='utf8', newline='\n').write(s)
print('patched')
