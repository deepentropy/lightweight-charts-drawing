/*
 * The scene of any drawing (moved from OpenTrader DrawingsOverlay
 * `renderKind`, port phase 3): the tool kind picks its scene builder. Used by
 * OpenTrader (SVG) and by this library's canvas runtime.
 */
import type { Pt } from "../_shared";
import type { Coords } from "../coords";
import type { Drawing } from "../types";
import type { TableUi } from "../kinds/table";
import type { Scene } from "./types";
import {
  sceneCrossLine, sceneExtendedSegment, sceneHorizontalLine, sceneHorizontalRay, sceneInfoLine, sceneTrendAngle, sceneTrendLine, sceneVerticalLine,
} from "./lines";
import { sceneDisjointChannel, sceneFlatTopBottom, sceneParallelChannel } from "./channels";
import {
  sceneFib, sceneFibChannel, sceneFibCircles, sceneFibExtension, sceneFibSpeedArcs, sceneFibSpeedFan, sceneFibSpiral, sceneFibTimeZone, sceneFibWedge,
  scenePitchfan, sceneTrendBasedFibTime,
} from "./fib";
import { sceneGannBox, sceneGannFan, sceneGannSquare, scenePitchfork } from "./gann";
import {
  sceneArc, sceneCircle, sceneCurve, sceneCyclicLines, sceneDoubleCurve, sceneEllipse, sceneRectangle, sceneRotatedRectangle, sceneSector, sceneSineLine,
  sceneTimeCycles, sceneTriangle,
} from "./shapes";
import { sceneLabeledPolyline } from "./patterns";
import { sceneArrowMark, sceneArrowMarker, sceneBarsPattern, sceneFlagMark, sceneFontIcon, sceneGhostFeed, scenePriceLabel } from "./markers";
import { sceneDateAndPriceRange, sceneDateRange, scenePriceRange } from "./ranges";
import { sceneAnchoredVolumeProfile, sceneAnchoredVwap, sceneFixedRangeVolumeProfile, sceneRegressionTrend } from "./data";
import { sceneForecast, scenePosition } from "./positions";
import { sceneCallout, sceneComment, sceneImage, scenePin, scenePriceNote, sceneSignpost, sceneTable, sceneTextNote, sceneTextTool } from "./text-tools";

export type SceneContext = {
  /** Pane size in px. */
  w: number;
  h: number;
  coords: Coords | null;
  /** Anchors shown (selected, or hovered for the tools TV shows them on). */
  selected: boolean;
  hovered?: boolean;
  /** Text tool: selected state for its outline / wrap anchor (default
   *  `selected`). */
  textSelected?: boolean;
  /** Table: the host's UI state for this table (active cell, edge, editor). */
  tableUi?: TableUi | null;
};

/** Screen scene of drawing `d` at the screen points `pts`. */
export function sceneOf(d: Drawing, pts: Pt[], c: SceneContext): Scene {
  const { w, h, coords, selected } = c;
  const hovered = !!c.hovered;
  const active = selected || hovered;
  const s = d.style;
  switch (d.kind) {
    case "horizontal-line":
      return sceneHorizontalLine(pts, selected, w, s);
    case "vertical-line":
      return sceneVerticalLine(pts, selected, h, s);
    case "cross-line":
      return sceneCrossLine(pts, selected, w, h, s);
    case "trend-line":
      // A plain trendline by default, but honour extend flags if a style sets
      // them (so a trendline toggled to extend renders like a ray/extended-line).
      return s.extendLeft || s.extendRight
        ? sceneExtendedSegment(d, pts, selected, w, h, s, !!s.extendLeft, !!s.extendRight, coords, active)
        : sceneTrendLine(d, pts, selected, w, h, s, coords, active);
    case "horizontal-ray":
      return sceneHorizontalRay(pts, selected, w, s);
    case "ray":
      // Extends past p2 by default; flags override (fallback keeps old rays right-extended).
      return sceneExtendedSegment(d, pts, selected, w, h, s, s.extendLeft ?? false, s.extendRight ?? true, coords, active);
    case "extended-line":
      // Extends both ways by default; flags override (fallback keeps old lines both-extended).
      return sceneExtendedSegment(d, pts, selected, w, h, s, s.extendLeft ?? true, s.extendRight ?? true, coords, active);
    case "info-line":
      return sceneInfoLine(d, pts, selected, w, h, s, coords, active);
    case "trend-angle":
      return sceneTrendAngle(d, pts, selected, w, h, s, coords, active);
    case "arrow": {
      // TV LineToolArrow = the trend line with rightEnd = Arrow (factory);
      // saves from before the line-end rows keep that arrow.
      const as = { ...s, leftEnd: s.leftEnd ?? 0, rightEnd: s.rightEnd ?? 1 };
      return as.extendLeft || as.extendRight
        ? sceneExtendedSegment(d, pts, selected, w, h, as, !!as.extendLeft, !!as.extendRight, coords, active)
        : sceneTrendLine(d, pts, selected, w, h, as, coords, active);
    }
    case "long-position":
      return scenePosition(d, pts, selected, "long", s, coords);
    case "short-position":
      return scenePosition(d, pts, selected, "short", s, coords);
    case "position-forecast":
      return sceneForecast(d, pts, selected, w, s, coords);
    case "parallel-channel":
      return sceneParallelChannel(pts, selected, s, w, h);
    case "disjoint-channel":
      return sceneDisjointChannel(d, pts, selected, s, w, h, coords);
    case "flat-top-bottom":
      return sceneFlatTopBottom(d, pts, selected, s, w, h, coords);
    case "fib-retracement":
      return sceneFib(d, pts, selected, w, s, coords);
    case "trend-based-fib-extension":
      return sceneFibExtension(d, pts, selected, w, s, coords);
    case "fib-channel":
      return sceneFibChannel(d, pts, selected, s, coords, w, h);
    case "trend-based-fib-time":
      return sceneTrendBasedFibTime(d, pts, selected, h, s, coords);
    case "fib-time-zone":
      return sceneFibTimeZone(pts, selected, h, s);
    case "fib-circles":
      return sceneFibCircles(d, pts, selected, s);
    case "fib-speed-resistance-fan":
      return sceneFibSpeedFan(d, pts, selected, w, h, s, coords);
    case "fib-speed-resistance-arcs":
      return sceneFibSpeedArcs(pts, selected, s);
    case "fib-spiral":
      return sceneFibSpiral(pts, selected, w, h, s);
    case "fib-wedge":
      return sceneFibWedge(pts, selected, s);
    case "pitchfan":
      return scenePitchfan(pts, selected, w, s);
    case "pitchfork":
    case "schiff-pitchfork":
    case "modified-schiff-pitchfork":
    case "inside-pitchfork":
      return scenePitchfork(d.kind, pts, selected, w, s);
    case "gann-fan":
      return sceneGannFan(pts, selected, w, h, s);
    case "gann-box":
      return sceneGannBox(d, pts, selected, s, coords);
    case "gann-square-fixed":
    case "gann-square":
      return sceneGannSquare(d, pts, selected, s, coords);
    case "rectangle":
      return sceneRectangle(d, pts, selected, w, s, hovered);
    case "rotated-rectangle":
      return sceneRotatedRectangle(d, pts, selected, s);
    case "circle":
      return sceneCircle(d, pts, selected, s, hovered);
    case "ellipse":
      return sceneEllipse(d, pts, selected, s, hovered);
    case "triangle":
      return sceneTriangle(pts, selected, s, hovered);
    case "arc":
      return sceneArc(pts, selected, s);
    case "curve":
      return sceneCurve(pts, selected, s);
    case "double-curve":
      return sceneDoubleCurve(pts, selected, s);
    case "sector":
      return sceneSector(pts, selected, s);
    case "cyclic-lines":
      return sceneCyclicLines(pts, selected, w, h, s);
    case "sine-line":
      return sceneSineLine(pts, selected, w, s);
    case "time-cycles":
      return sceneTimeCycles(pts, selected, w, s);
    case "abcd-pattern":
    case "xabcd-pattern":
    case "cypher-pattern":
    case "head-and-shoulders":
    case "triangle-pattern":
    case "three-drives-pattern":
    case "elliott-impulse":
    case "elliott-correction":
    case "elliott-triangle":
    case "elliott-double-combo":
    case "elliott-triple-combo":
    case "polyline":
    case "path":
    case "brush":
    case "highlighter":
      return sceneLabeledPolyline(d, pts, selected, s);
    case "arrow-marker":
      return sceneArrowMarker(pts, selected, s);
    case "arrow-mark-up":
      return sceneArrowMark(d, pts, selected, s, "up");
    case "arrow-mark-down":
      return sceneArrowMark(d, pts, selected, s, "down");
    case "flag-mark":
      return sceneFlagMark(pts, selected, s);
    case "price-label":
      return scenePriceLabel(d, pts, selected, s, coords);
    case "font-icon":
      return sceneFontIcon(d, pts, selected);
    case "bar-pattern":
      return sceneBarsPattern(d, pts, selected, s, coords);
    case "ghost-feed":
      return sceneGhostFeed(d, pts, selected, s, coords);
    case "price-range":
      return scenePriceRange(d, pts, selected, w, h, s, coords);
    case "date-range":
      return sceneDateRange(d, pts, selected, h, s, coords);
    case "date-and-price-range":
      return sceneDateAndPriceRange(d, pts, selected, h, s, coords);
    case "regression-trend":
      return sceneRegressionTrend(d, pts, selected, w, s, coords);
    case "anchored-vwap":
      return sceneAnchoredVwap(d, pts, selected, w, s, coords);
    case "fixed-range-volume-profile":
      return sceneFixedRangeVolumeProfile(d, pts, selected, coords);
    case "anchored-volume-profile":
      return sceneAnchoredVolumeProfile(d, pts, selected, coords);
    case "text":
      return sceneTextTool(d, pts[0], c.textSelected ?? selected, hovered);
    case "pin":
      return scenePin(d, pts[0], selected, w);
    case "note":
      return sceneTextNote(d, pts, selected, s);
    case "comment":
      return sceneComment(d, pts, selected, s);
    case "price-note":
      return scenePriceNote(d, pts, selected, s, coords);
    case "signpost":
      return sceneSignpost(d, pts[0], coords, h, selected);
    case "callout":
      return sceneCallout(d, pts, selected, s);
    case "table":
      return sceneTable(d, pts[0], selected, c.tableUi ?? null);
    case "image":
      return sceneImage(d, pts[0], selected);
  }
  return [];
}
