# Tool reference

Generated from `OVERLAY_SPECS` (src/core/specs.ts) by test/skill-examples.test.ts. Do not edit:
run `npx vitest run -u` after changing a spec.

86 tools. **Placement**: clicks the user makes (`spec.pointCount`). **Points**: length of
`drawing.points` once placed (`buildNewDrawing`); pass that many points to `add`. **Text**: the tool
carries a `text` field and fires `textEdit`. **Defaults**: the tool's style on top of `DEFAULT_STYLE`
(color #2962ff, width 1, lineStyle solid); arrays show their length (and visible entries).

| kind | Placement | Points | Text | Defaults |
|---|---|---|---|---|
| `horizontal-line` | 1 click | 1 |  | width 2, textColor #2962ff, showPriceLabels true |
| `horizontal-ray` | 1 click | 1 |  | width 2, showPriceLabels true |
| `vertical-line` | 1 click | 1 |  | width 2, textColor #2962ff, showTime true, extendLine true |
| `cross-line` | 1 click | 1 |  | width 2, textColor #ffffff, showPriceLabels true, showTime true |
| `arrow-marker` | 2 clicks | 2 |  | color #1e53e5, width 2, textColor #1e53e5, fontSize 16, bold true |
| `arrow-mark-up` | 1 click | 1 |  | color #089981, fontSize 14 |
| `arrow-mark-down` | 1 click | 1 |  | color #cc2f3c, fontSize 14 |
| `price-label` | 1 click | 1 |  | color #2962ff, textColor #ffffff, fontSize 14, backgroundColor #2962ff, borderColor #2962ff, transparency 0 |
| `flag-mark` | 1 click | 1 |  | color #2962ff |
| `trend-line` | 2 clicks | 2 |  | width 2, textColor #2962ff, fontSize 14, horzLabelsAlign center, vertLabelsAlign bottom |
| `ray` | 2 clicks | 2 |  | width 2, textColor #2962ff, fontSize 14, horzLabelsAlign center, vertLabelsAlign bottom, extendRight true |
| `extended-line` | 2 clicks | 2 |  | width 2, textColor #2962ff, fontSize 14, horzLabelsAlign center, vertLabelsAlign bottom, extendLeft true, extendRight true |
| `info-line` | 2 clicks | 2 |  | width 2, textColor #2962ff, fontSize 14, horzLabelsAlign center, vertLabelsAlign bottom, showStats true, showPriceRange true, showPercentPriceRange true, showPipsPriceRange true, showBarsRange true, showDateTimeRange true, showDistance true, showAngle true |
| `trend-angle` | 2 clicks | 2 |  | width 2, fontSize 12 |
| `long-position` | 1 click | 2 |  | color #808080, width 1, textColor #ffffff, fontSize 12, stopColor #f23645, stopTransparency 80, targetColor #089981, targetTransparency 80, showPriceLabels true, accountSize 1000, riskPercent 25, lotSize 1, riskDisplayMode percents, leverage 10000, qtyPrecision default |
| `short-position` | 1 click | 2 |  | color #808080, width 1, textColor #ffffff, fontSize 12, stopColor #f23645, stopTransparency 80, targetColor #089981, targetTransparency 80, showPriceLabels true, accountSize 1000, riskPercent 25, lotSize 1, riskDisplayMode percents, leverage 10000, qtyPrecision default |
| `gann-fan` | 2 clicks | 2 |  | width 2, levels [9], fillBackground true, transparency 80 |
| `gann-box` | 2 clicks | 2 |  | color rgba(21, 56, 153, 0.8), width 2, lineStyle solid, levels [7], vLevels [7], showLeftLabels true, showRightLabels true, showTopLabels true, showBottomLabels true, fillBackground true, transparency 80, fillVertBackground true, vertTransparency 80, fans {…}, reverse false |
| `fib-time-zone` | 2 clicks | 2 |  | width 2, levels [11], fillBackground false, transparency 80, showLabels true, horzLabelsAlign right, vertLabelsAlign bottom |
| `fib-circles` | 2 clicks | 2 |  | color #808080, width 2, levels [11], fillBackground true, transparency 80 |
| `fib-speed-resistance-fan` | 2 clicks | 2 |  | width 2, levels [7], vLevels [7], fillBackground true, transparency 80, showLeftLabels true, showRightLabels true, showTopLabels true, showBottomLabels true, reverse false, fanGrid {…} |
| `fib-speed-resistance-arcs` | 2 clicks | 2 |  | width 2, levels [11], fillBackground true, transparency 80 |
| `fib-spiral` | 2 clicks | 2 |  | color #00bcd4, width 2 |
| `trend-based-fib-time` | 3 clicks | 3 |  | width 2, levels [11, 10 visible], fibTrendLine {…}, fillBackground true, transparency 80, showLabels true, horzLabelsAlign right, vertLabelsAlign bottom |
| `gann-square-fixed` | 2 clicks | 2 |  | width 2, gannLevels [6], gannFans [11, 3 visible], gannArcs [11], fillBackground true, transparency 80, reverse false |
| `gann-square` | 2 clicks | 2 |  | width 2, gannLevels [6], gannFans [11, 3 visible], gannArcs [11], fillBackground true, transparency 80, reverse false, showLabels true, labelFontSize 12 |
| `sector` | 3 clicks | 3 |  | color #9c9c9c, width 2, fillBackground true, transparency 80, sectorColor1 #2962ff, sectorColor2 #9c27b0 |
| `fib-wedge` | 3 clicks | 3 |  | width 2, levels [11, 6 visible], fillBackground true, transparency 80 |
| `pitchfan` | 3 clicks | 3 |  | color #f23645, width 2, levels [9, 2 visible], fillBackground true, transparency 80 |
| `cyclic-lines` | 2 clicks | 2 |  | color #80ccdb, width 2 |
| `sine-line` | 2 clicks | 2 |  | color #159980, width 2 |
| `time-cycles` | 2 clicks | 2 |  | color #159980, width 2, fillBackground true, backgroundColor #6aa84f, transparency 50 |
| `fib-retracement` | 2 clicks | 2 |  | width 2, levels [24, 11 visible], fillBackground true, transparency 80 |
| `arrow` | 2 clicks | 2 |  | width 2, textColor #2962ff, fontSize 14, horzLabelsAlign center, vertLabelsAlign bottom, leftEnd 0, rightEnd 1 |
| `rectangle` | 2 clicks | 2 |  | color #9c27b0, width 2, fillBackground true, backgroundColor #9c27b0, transparency 50, rectMiddleLine {…} |
| `circle` | 2 clicks | 2 |  | width 2, color #ff9800, fillBackground true, backgroundColor #ff9800, transparency 80 |
| `ellipse` | 3 clicks | 3 |  | width 2, color #f23645, fillBackground true, backgroundColor #f23645, transparency 50 |
| `price-range` | 2 clicks | 2 |  | width 2, color #2962ff, fillBackground true, backgroundColor #2962ff, transparency 85, textColor #ffffff, fontSize 12, customTextColor #2962ff, customTextSize 12 |
| `date-range` | 2 clicks | 2 |  | width 2, color #2962ff, fillBackground true, backgroundColor #2962ff, transparency 85, textColor #ffffff, fontSize 12, customTextColor #2962ff, customTextSize 12 |
| `date-and-price-range` | 2 clicks | 2 |  | width 2, color #2962ff, fillBackground true, backgroundColor #2962ff, transparency 85, textColor #ffffff, fontSize 12, customTextColor #2962ff, customTextSize 12 |
| `position-forecast` | 2 clicks | 2 |  | width 2, color #2962FF, transparency 10, sourceTextColor #ffffff, sourceBackColor #2962FF, sourceStrokeColor #2962FF, targetTextColor #ffffff, targetBackColor #2962FF, targetStrokeColor #2962FF, successTextColor #ffffff, successBackground #4caf50, failureTextColor #ffffff, failureBackground #F23645 |
| `bar-pattern` | 2 clicks | 2 |  |  |
| `ghost-feed` | 2+ clicks, double-click to finish | = clicks |  | variance 50, transparency 50 |
| `triangle` | 3 clicks | 3 |  | width 2, color #089981, fillBackground true, backgroundColor #089981, transparency 80 |
| `parallel-channel` | 3 clicks | 3 |  | width 2, levels [7, 3 visible], fillBackground true, transparency 80, textColor #2962ff, fontSize 14, horzLabelsAlign left, vertLabelsAlign bottom |
| `pitchfork` | 3 clicks | 3 |  | color #f23645, width 2, levels [9, 2 visible], fillBackground true, transparency 80 |
| `trend-based-fib-extension` | 3 clicks | 3 |  | width 2, levels [24, 11 visible], fillBackground true, transparency 80 |
| `disjoint-channel` | 3 clicks | 3 |  | color #089981, width 2, fillBackground true, backgroundColor #089981, transparency 80, textColor #089981, fontSize 14, horzLabelsAlign left, vertLabelsAlign bottom, showPrices false, priceLabelTextColor #089981, priceLabelFontSize 12, leftEnd 0, rightEnd 0 |
| `flat-top-bottom` | 3 clicks | 3 |  | color #ff9800, width 2, fillBackground true, backgroundColor #ff9800, transparency 80, textColor #ff9800, fontSize 14, horzLabelsAlign left, vertLabelsAlign bottom, showPrices false, priceLabelTextColor #ff9800, priceLabelFontSize 12, leftEnd 0, rightEnd 0 |
| `schiff-pitchfork` | 3 clicks | 3 |  | color #f23645, width 2, levels [9, 2 visible], fillBackground true, transparency 80 |
| `modified-schiff-pitchfork` | 3 clicks | 3 |  | color #f23645, width 2, levels [9, 2 visible], fillBackground true, transparency 80 |
| `inside-pitchfork` | 3 clicks | 3 |  | color #f23645, width 2, levels [9, 2 visible], fillBackground true, transparency 80 |
| `fib-channel` | 3 clicks | 3 |  | width 2, levels [24, 11 visible], fillBackground true, transparency 80, showPrices true, showCoeffs true, fibLevelsAsPercents false, labelFontSize 12, horzLabelsAlign left, vertLabelsAlign middle |
| `rotated-rectangle` | 3 clicks | 3 |  | color #4caf50, width 2, fillBackground true, backgroundColor #4caf50, transparency 50 |
| `curve` | 2 clicks | 3 |  | width 2, fillBackground false, backgroundColor #2962ff, transparency 50 |
| `arc` | 3 clicks | 3 |  | width 2, color #e91e63, fillBackground true, backgroundColor #e91e63, transparency 80 |
| `double-curve` | 2 clicks | 4 |  | color #673ab7, width 2, fillBackground false, backgroundColor #673ab7, transparency 80 |
| `abcd-pattern` | 4 clicks | 4 |  | color #089981, width 2, textColor #ffffff, fontSize 12 |
| `xabcd-pattern` | 5 clicks | 5 |  | color #2962ff, width 2, textColor #ffffff, backgroundColor #2962ff, fillBackground true, transparency 85, fontSize 12 |
| `cypher-pattern` | 5 clicks | 5 |  | color #2962ff, width 2, textColor #ffffff, backgroundColor #2962ff, fillBackground true, transparency 85, fontSize 12 |
| `head-and-shoulders` | 7 clicks | 7 |  | color #089981, width 2, textColor #ffffff, fontSize 12, fillBackground true, backgroundColor #089981, transparency 85 |
| `triangle-pattern` | 4 clicks | 4 |  | color #673ab7, width 2, textColor #ffffff, fontSize 12, fillBackground true, backgroundColor #673ab7, transparency 85 |
| `three-drives-pattern` | 7 clicks | 7 |  | color #673ab7, width 2, textColor #ffffff, fontSize 12 |
| `elliott-impulse` | 6 clicks | 6 |  | color #3d85c6, width 2 |
| `elliott-correction` | 4 clicks | 4 |  | color #3d85c6, width 2 |
| `elliott-triangle` | 6 clicks | 6 |  | color #ff9800, width 2 |
| `elliott-double-combo` | 4 clicks | 4 |  | color #6aa84f, width 2 |
| `elliott-triple-combo` | 6 clicks | 6 |  | color #6aa84f, width 2 |
| `polyline` | 2+ clicks, double-click to finish | = clicks |  | color #00bcd4, width 2, fillBackground true, transparency 80 |
| `path` | 2+ clicks, double-click to finish | = clicks |  | width 2, leftEnd 0, rightEnd 1 |
| `brush` | press, drag, release | sampled |  | color #00bcd4, width 2, fillBackground false, backgroundColor #00bcd4, transparency 80, leftEnd 0, rightEnd 0 |
| `highlighter` | press, drag, release | sampled |  | color #f23645, width 20 |
| `text` | 1 click | 1 | yes | color #2962ff, fontSize 14, fillBackground false, backgroundColor #2962ff, transparency 75, drawBorder false, borderColor #707070, wordWrap false, wordWrapWidth 200 |
| `note` | 2 clicks | 2 | yes | color #dbdbdb, textColor #dbdbdb, backgroundColor #2e2e2e, fillBackground true, fontSize 14 |
| `pin` | 1 click | 1 | yes | color #2962ff, textColor #dbdbdb, fontSize 14, fillBackground true, backgroundColor #2e2e2e, transparency 0, drawBorder false, borderColor #4a4a4a |
| `comment` | 1 click | 1 | yes | color #2962ff, textColor #ffffff, fontSize 16, backgroundColor #2962ff, borderColor #2962ff, transparency 0 |
| `price-note` | 2 clicks | 2 | yes | color #2962ff, textColor #2962ff, fontSize 14, horzLabelsAlign center, vertLabelsAlign bottom, priceLabelTextColor #ffffff, priceLabelFontSize 12, priceLabelBackgroundColor #2962ff, priceLabelBorderColor #2962ff |
| `signpost` | 1 click | 1 | yes | fontSize 12, showImage false, plateColor #2962ff, signpostPosition 50 |
| `callout` | 2 clicks | 2 | yes | color #0097a7, width 2, textColor #ffffff, fontSize 14, backgroundColor #0097a7, transparency 50, wordWrap false, wordWrapWidth 200 |
| `font-icon` | 1 click | 1 |  | fontSize 72, color #2962ff |
| `table` | 1 click | 1 |  | color #575757, backgroundColor #0f0f0f, textColor #dbdbdb, fontSize 14, horzLabelsAlign left |
| `image` | host: `addImage` | 1 |  | transparency 0 |
| `regression-trend` | 2 clicks | 2 |  | upperDeviation 2, lowerDeviation -2, useUpperDeviation true, useLowerDeviation true, regressionSource close, showPearsons true, fillBackground true, transparency 70, regressionLines {…} |
| `anchored-vwap` | 1 click | 1 |  | color #1e88e5, width 1, vwapSource hlc3, levels [3, 1 visible], fillBackground true, backgroundColor #4caf50, transparency 95 |
| `fixed-range-volume-profile` | 2 clicks | 2 |  |  |
| `anchored-volume-profile` | 1 click | 1 |  |  |
