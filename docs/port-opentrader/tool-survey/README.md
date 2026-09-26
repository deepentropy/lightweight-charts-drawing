# Tool survey (port phase 4, 26/09/2026)

Every tool of the core specs (86) in the runtime demo, with real mouse and
keyboard events: `survey.js` (Playwright MCP `browser_run_code_unsafe`, the
demo served at http://localhost:3009/lightweight-charts-drawing/ by
`npx vite --config vite.demo.config.ts --port 3009`).

Per tool:

| Step | How | Pass condition |
|---|---|---|
| place | clicks at fixed pane points by the tool's point count; press-drag for brush / highlighter; 4 clicks + a click on the last point for polyline / path / ghost feed; `addImage` for the image; `window.autoText` answers text tools; glyph "★" for the font icon | one drawing with the tool's point count, tool disarmed |
| select | click on empty space, then a real click on a body pixel found with the runtime hit test (4 px grid) | the drawing is selected |
| anchor drag | real drag of the last anchor by (25, 15) px | points / style change |
| body drag | real drag of a body pixel of the selected drawing by (30, 20) px | points / style change |
| delete | Delete key | no drawing left |

## Result

86 / 86 tools pass every step; no page errors.

- Text and font icon have no anchor (TV: the text shows its wrap anchor only
  with word wrap on; the font icon shows a dashed box), so their anchor-drag
  step does not apply.
- Point counts after placement (from the survey output, 86 tools): 1 point
  17 tools, 2 points 34, 3 points 18, 4 points 8, 5 points 2, 6 points 3,
  7 points 2, and brush / highlighter 25 samples each. The per-tool rows were
  returned by the run and are not stored in a file.

Screenshots of each placed tool (just after placement, selected): contact
sheets `sheet-1.png` .. `sheet-3.png` (alphabetical order).

The demo data (demo/public/SPY.csv) has no volume, so the fixed range and
anchored volume profiles draw their box and a POC on the lowest row only.
With bars that carry a volume (`bars` option, here synthetic volumes set for
the check) both histograms draw as expected: `volume-profiles-with-volume.png`
(fixed range from the left edge, anchored from the right, POC lines). The
anchored VWAP uses equal weights when volume is absent (core rule).
