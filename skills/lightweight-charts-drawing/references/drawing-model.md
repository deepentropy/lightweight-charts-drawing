# Drawing model

Source of truth: `src/core/types.ts` (types), `src/core/specs.ts` (tools and their default style),
`src/core/serialize.ts` (load and migration), `src/core/interact/placement.ts` (clicks to points).

## Types

```ts
type DataPoint = { time: Time; price: number };          // Time from lightweight-charts
type Drawing = {                                           // a placed drawing (what is saved)
  id: string;
  kind: DrawingKind;                                       // "trend-line", "fib-retracement", ...
  points: [DataPoint, ...];                                // tuple, length fixed per kind
  style: DrawingStyle;
  // optional, all saved:
  name?: string;      // user label of the drawing (object lists)
  text?: string;      // content of the text tools
  glyph?: string;     // font-icon: an emoji or raw <svg> markup
  image?: { name: string; cssWidth: number; cssHeight: number };    // image tool, size in px
  pattern?: { base: number; bars: [o, h, l, c][] };                 // bar-pattern snapshot
  ghost?: { seed: number; amplitude: number };                      // ghost-feed generation
  anchored?: { x: number; y: number };   // text / pin / table fixed to the pane (fractions 0..1)
  closed?: boolean;   // polyline closed into a filled shape
  locked?: boolean;   // selectable, no drag, no Delete
  hidden?: boolean;   // not drawn, hit or selected
  visibility?: IntervalVisibility;      // per-interval visibility; absent = always shown
  fmt?: number;       // point-model version (circle, arc, fib-circles, rotated-rectangle: 2)
  group?: string;     // host grouping tag
  owner?: string;     // id of the study whose pane holds the drawing; absent = main series pane
};
type NewDrawing = {                                        // input of add(): no id, style optional
  kind; points; style?; text?; glyph?; image?; pattern?; ghost?; closed?; fmt?; owner?;
};                                                         // add() also takes a whole Drawing (keeps its id)
```

`Drawing` and `NewDrawing` are unions discriminated by `kind`: narrow with `if (d.kind === "...")`
before reading `d.points[1]`. Ids are free strings; the manager makes `dw_<time>_<random>`.

## Style (`DrawingStyle`)

Required: `color`, `width` (px), `lineStyle` (`"solid" | "dashed" | "dotted"`). Everything else is
optional and read only by the tools that use it; unset means the tool's default. The defaults of
each tool are in [tools.md](tools.md); `defaultStyleFor(kind)` returns them (with the host's saved
defaults, see `setDefaultStyleOverride`), `factoryStyleFor(kind)` without the host's defaults.

Main groups (full list with comments in `src/core/types.ts`):

| Group | Fields |
|---|---|
| Line ends and extension | `extendLeft`, `extendRight`, `leftEnd` / `rightEnd` (0 none, 1 arrow), `showMiddlePoint` |
| Label on a line | `text`, `textColor`, `fontSize`, `bold`, `italic`, `horzLabelsAlign`, `vertLabelsAlign` |
| Stats | `showStats`, `statsPosition`, `showPriceRange`, `showPercentPriceRange`, `showBarsRange`, `showDateTimeRange`, `showDistance`, `showAngle` |
| Fill | `fillBackground`, `backgroundColor`, `transparency` (0-100, higher = more transparent) |
| Levels | `levels: LevelDef[]` (`coeff`, `color`, `visible`, optional `width`, `style`, `label`, `text`), `vLevels`, `reverse`, `fibLevelsAsPercents`, `fibLevelsBasedOnLogScale`, `showPrices`, `showCoeffs`, `labelFontSize` |
| Axis labels | `showPriceLabels`, `showTime` |
| Text box | `drawBorder`, `borderColor`, `wordWrap`, `wordWrapWidth` (px) |
| Positions | `stopLevel`, `profitLevel` (price offsets from the entry), `accountSize`, `riskPercent`, `lotSize`, `riskDisplayMode`, `riskAmount`, `leverage`, `qtyPrecision`, `stopColor`, `targetColor`, `positionStats` |
| Data tools | `regressionLines`, `upperDeviation`, `lowerDeviation`, `regressionSource`, `vwapSource`, `vwapBandsMode`, `vp` (volume profile settings, defaults from `volumeProfileDefaults(kind)`) |
| Table | `tableCells: string[][]`, `tableColWidths`, `tableRowHeights` (px) |

Levels: an unset `levels` means the tool's factory ladder. `defaultStyleFor` returns a copy, so
`style.levels.map(...)` is safe. Only `visible` levels are drawn, sorted by `coeff`.

## Point model per tool family

The number of points is in [tools.md](tools.md) ("Points"). What each point means:

| Tools | Points |
|---|---|
| `horizontal-line`, `horizontal-ray`, `vertical-line`, `cross-line` | the line's price / time (the ray starts at the time) |
| `arrow-mark-up` / `-down`, `flag-mark`, `price-label`, `font-icon` | the marked point (`font-icon` needs `glyph`) |
| `text`, `pin`, `comment`, `signpost` | the text anchor; signpost: the bar, label height in `style.signpostPosition` (% of pane) |
| `table` | top-left corner; `image`: centre (size in `image`) |
| `anchored-vwap`, `anchored-volume-profile` | the anchor bar; computed up to the last bar |
| line family (`trend-line`, `ray`, `extended-line`, `info-line`, `trend-angle`, `arrow`, `arrow-marker`) | start, end (`arrow-marker`: tail, head) |
| `rectangle`, `gann-box`, `date-and-price-range`, `price-range`, `date-range`, `fixed-range-volume-profile`, `bar-pattern` | two opposite corners / start and end |
| `fib-retracement` | swing start, swing end: level 0 on the **second** point, level 1 on the first |
| `trend-based-fib-extension` | trend start, trend end, projection start (level 0) |
| `circle` (`fmt: 2`) | centre, a point on the circle; `fib-circles` (`fmt: 2`): the circles' centre is the midpoint |
| `ellipse` | the two ends of one axis, a point on the other axis |
| `rotated-rectangle` (`fmt: 2`) | centre line start, end, a point at the half-width |
| `arc` (`fmt: 2`) | chord start, chord end, bulge point |
| `curve` / `double-curve` | start, control point(s), end (placed with 2 clicks; the controls are derived) |
| `parallel-channel` | first line start, end; third point = the channel offset **at the first point's time** |
| `pitchfork` family | pivot, then the two ends of the base |
| `long-position` / `short-position` | entry, close point (time = box end, price = entry); stop / target are `style.stopLevel` / `style.profitLevel` price offsets |
| `position-forecast` | entry, target |
| `note` | anchor (dot), label box; `callout`: pointer tip, balloon centre; `price-note`: price bubble point, line end |
| patterns and Elliott waves | the vertices in order (count fixed per tool) |
| `polyline`, `path`, `brush`, `highlighter`, `ghost-feed` | 2 or more vertices |

When a tool needs data computed at placement (position box size, curve controls, Gann square
ratio, bar-pattern snapshot, trend angle, ghost-feed seed), build it from clicks with
`finishPlacement` (see [code-api.md](code-api.md)) instead of writing the points by hand.

## Saved format

A save is a JSON array of `Drawing` objects, exactly the in-memory model:

```json
[{"id":"dw_m1x2_ab3cd","kind":"trend-line","points":[{"time":1767571200,"price":103},{"time":1768867200,"price":118}],"style":{"color":"#089981","width":2,"lineStyle":"solid","extendRight":true}}]
```

- Write: `manager.exportJSON()` (or `JSON.stringify(manager.drawings())`). The array order is the
  z-order (last on top).
- Read: `manager.importJSON(json)` replaces every drawing; without a manager use
  `parseDrawings(JSON.parse(json))`. Both keep entries with a string `id`, a string `kind` and a
  non-empty `points` array of `{ time, price: number }`, fill a missing `style` with
  `DEFAULT_STYLE`, and run `migrateDrawing` (older point models, tagged with `fmt`).
- Storage is the host's. OpenTrader saves one array per symbol in a key-value store and loads it
  with `parseDrawings` (`src/window/drawings/persistence.ts` there).
- Times are saved as given. Saving with one `Time` format and loading on a series using another
  breaks the placement: keep the series' format.
