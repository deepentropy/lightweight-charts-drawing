# Adding or changing a tool

Work in the repository (`src/`), not in `node_modules`. Pick the existing tool closest to the new
one and follow it through every file below; `grep -rn '"<kind>"' src` lists them. Do not guess a
behaviour (anchor positions, labels, defaults): copy what the existing code does or ask.

## File layout

```
src/core/types.ts            DrawingKind union + the points tuple of each kind; style fields
src/core/specs.ts            OVERLAY_SPECS: clicks, preview, flags, hotkey, default style; level ladders
src/core/interact/placement.ts  buildNewDrawing (clicks -> stored points), finishPlacement (placement-time data)
src/core/interact/project.ts    replaceDrawingPoints (keeps the tuple length of each kind)
src/core/interact/drag.ts       applyDrag: per-kind anchor semantics (virtual anchors, bbox corners)
src/core/interact/shift.ts      Shift rules while placing and dragging
src/core/scene/<family>.ts      scene builder of the tool (lines, channels, fib, gann, shapes, ...)
src/core/scene/index.ts         sceneOf: kind -> scene builder
src/core/kinds/hit-tests.ts     hitTestKind: kind -> hit test
src/core/kinds/<tool>.ts        geometry shared by the scene and the hit test (layouts, anchors)
src/core/kinds/axis-labels.ts   price / time axis labels of the drawings
src/core/serialize.ts           migrateDrawing: when a saved point model changes
src/runtime/manager.ts          mouse, keys, preview, events (generic, driven by the spec flags)
src/runtime/scene-canvas.ts     canvas painter of the scene items
```

The core never imports lightweight-charts at runtime (types only) and has no UI. OpenTrader uses
`src/core` directly and paints the same scenes as SVG: a new scene item type needs support in
`scene-canvas.ts` and in OpenTrader's renderer, so prefer the existing item types.

## Steps

1. **Type** (`types.ts`): add the kind to `DrawingKind` and to the tuple union with its stored
   point count (`OnePoint`, `TwoPoint`, ...; `PolyPoint` for variable length). New style fields go
   in `DrawingStyle`, optional, with a comment.
2. **Spec** (`specs.ts`): `OVERLAY_SPECS[kind] = { kind, pointCount, preview, isBbox, defaults }`.
   `pointCount` = user clicks (minimum for `variableLength`). Flags: `variableLength` (click per
   vertex, double-click to finish), `freehand` (drawn with the button held), `textEditable` (has
   `text`, fires `textEdit`), `isBbox` (2 corners, 4-corner drag), `hotkey`. `defaults` = only the
   fields that differ from `DEFAULT_STYLE`. `OVERLAY_SPECS` is a `Record<DrawingKind, ...>`: the
   compiler reports a missing entry.
3. **Placement** (`placement.ts`): a `buildNewDrawing` case mapping the clicks to stored points.
   It is also called for the live preview with the cursor repeated for the missing clicks, so it
   must accept equal points. Data that needs the chart (pixel sizes, bars) goes in a
   `finishPlacement` step.
4. **Points** (`project.ts`): a `replaceDrawingPoints` case with the tuple length (the compiler
   reports a missing case).
5. **Scene** (`scene/<family>.ts` + a case in `scene/index.ts`): a pure function of the screen
   points, the style, the pane size and `coords`, returning `Scene` items in paint order. Emit
   `{ t: "anchors", pts }` when `selected` (one anchor per draggable point), `hit` items along thin
   strokes for DOM hosts, text with the `scene/text.ts` helpers. Without a case `sceneOf` draws
   nothing.
6. **Hit test** (`hit-tests.ts`): return anchors first (`{ hit: "handle", handleIndex }`, radius
   `HANDLE_RADIUS + HIT_TOLERANCE`), then the body (`{ hit: "body" }`, stroke tolerance
   `strokeTolerance(style)`), then the inside of a fill as `{ hit: "body", background: true }`
   only while `fillBackground !== false`, else null. Compute the shape with the same function as the scene
   (put it in `kinds/<tool>.ts`) so what is drawn is what is hit.
7. **Drag** (`drag.ts`): the default moves point `handleIndex` to the cursor (magnet applied) and
   translates every point on a body drag. Add a case only for other semantics (an anchor that is not
   a stored point, a price-only or time-only anchor, derived points). Shift rules go in `shift.ts`
   (`shiftPlacementPoint`, `shiftAnchorDrag`).
8. **Mouse and keys**: nothing per tool in `manager.ts`; the spec flags drive placement, preview,
   finishing, text editing. Escape, Delete, Ctrl and Shift handling is shared.
9. **Axis labels** (`axis-labels.ts`): only if the tool shows labels other than its points'
   prices (`showPriceLabels`) or time (`showTime`).
10. **Saved drawings**: when the meaning or count of stored points changes, add a
    `migrateDrawing` case (tag the new model with `fmt` if the count stays the same) so older saves
    still load.
11. **Tests and docs**: a test in `test/` (vitest; the mock `Coords` in
    `test/skill-examples.test.ts` needs no chart) covering placement, scene and hit test. Run
    `npx vitest run -u` to regenerate `skills/lightweight-charts-drawing/references/tools.md`,
    `python docs/tools_md.py <opentrader>/src/data/drawing-toolbar.ts` for `docs/TOOLS.md` and the
    demo toolbar, then `npm run typecheck`, `npm test`, `npm run build`. Add a CHANGELOG entry.
