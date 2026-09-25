# Runtime check (port phase 3.3, 25/09/2026)

Page: `demo/runtime/` (`npx vite --config demo/runtime/vite.config.ts`,
http://localhost:3007): the `DrawingManager` on a candlestick chart of
`demo/SPY.csv`, every tool of the core specs, magnet, keep drawing, event log;
`window.dm` / `window.chart` / `window.series` for scripted checks,
`window.autoText` answers the text editor request in scripted runs.

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

Not in this runtime yet: drawings' price / time axis labels, anchor hover
halo check, table cell editing and image placement (host side), a hover
check of the anchors.
