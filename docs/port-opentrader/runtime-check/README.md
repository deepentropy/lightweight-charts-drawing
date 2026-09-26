# Runtime check (port phase 3.3 - 3.5, 25-26/09/2026)

Page: the demo (`demo/`, `npm run demo`; built: `npm run build:demo` +
`npx vite preview --config vite.demo.config.ts`): the `DrawingManager` on a
candlestick chart of SPY, every tool of the core specs, magnet, keep
drawing, JSON export / import, event log; `window.dm` / `window.chart` /
`window.series` for scripted checks, `window.autoText` answers the text
editor request in scripted runs. (Until 26/09/2026 the same page lived in
`demo/runtime/`.)

Scripted session (Playwright, real mouse / keyboard events):

| Check | Result |
|---|---|
| Trend line, rectangle placed by 2 clicks; new drawing selected, tool disarmed, events add / selection / tool / gestureEnd | pass (01-trend-rectangle.png: TV anchors, rectangle edge squares) |
| Anchor drag of an unselected trend line end (moves, selects, chart not panned) | pass |
| Body drag of the selected trend line (moves, chart not panned) | pass |
| Press-drag on an unselected rectangle body: selects only, no move (TV) | pass |
| Click on empty space clears the selection | pass |
| Delete removes the selected drawing | pass |
| Drag on empty space after a drawing drag pans the chart | fail first (options() returns live objects: the saved scroll options were overwritten), pass after the fix |
| Long position placed by 1 click (stop = profit = 20 % of the visible range) | pass (59.52 / 59.52) |
| Brush: press-drag-release, 21 points | pass |
| Polyline: 3 clicks + double-click finishes (open) | pass (4 points, closed false) |
| Text: placement asks the host editor (textEdit event), text stored | pass ("Hello") |
| Fib retracement with the strong magnet: both points on an OHLC price | pass |
| Shift on a trend line second point: 45-degree step | pass (raw 21 degrees -> 0) |
| Escape: first drops the pending point (tool stays), second disarms | pass |
| Ctrl+click multi-select, body drag moves the selected group | pass (02-tools-session.png) |

Axis labels (26/09/2026, 03-axis-labels.png): vertical and cross line time
labels in the line colour (chart time formatter; without one a
crosshair-like "d MMM 'yy   HH:mm"), the cross line price, the position
entry / target / stop (grey / green / red), the anchored VWAP last value,
the point prices of a trend line with Price labels; prices formatted by the
series. They are lightweight-charts axis views of the primitive (drawn like
the chart's own labels).

Not in this runtime yet: table cell editing and image placement (host
side), a hover check of the anchors.

Built demo (26/09/2026, 04-demo-build.png, served like GitHub Pages under
/lightweight-charts-drawing/): no page errors; fib retracement, pitchfork,
text, rectangle, Elliott impulse, sector placed by mouse; export -> clear ->
import restores the 6 drawings.
