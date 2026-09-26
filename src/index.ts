/**
 * lightweight-charts-drawing 0.2 (in progress)
 *
 * TradingView-style drawing tools for lightweight-charts v5, built on a shared
 * drawing core (src/tv: tool model + TradingView factory defaults, hit tests,
 * placement / drag rules, renderer-neutral scenes) and a canvas runtime
 * (src/runtime: DrawingManager).
 *
 * @packageDocumentation
 */

// ============ Runtime ============
export { DrawingManager, type DrawingManagerEvents, type DrawingManagerOptions, type MagnetMode } from "./runtime/manager";
export { makeCoords, timeToXFallback } from "./runtime/coords";
export { drawScene, TV_ANCHOR_COLOR, type AnchorStyle, type CanvasSceneOptions } from "./runtime/scene-canvas";

// ============ Core model ============
export {
  DEFAULT_STYLE,
  isVisibleOnInterval,
  type DataPoint,
  type Drawing,
  type DrawingKind,
  type DrawingStyle,
  type LevelDef,
  type NewDrawing,
} from "./tv/types";
export { OVERLAY_SPECS, defaultStyleFor, findOverlaySpec, setDefaultStyleOverride, type OverlaySpec } from "./tv/specs";
export type { Coords, OHLC } from "./tv/coords";
export type { Pt, HitResult } from "./tv/_shared";
export { parseDrawings, migrateDrawing } from "./tv/serialize";

// ============ Scenes and hit tests (hosts drawing their own way) ============
export { sceneOf, sceneLockedAnchors, type SceneContext } from "./tv/scene";
export type { Scene, SceneItem, Paint, Shadow } from "./tv/scene/types";
export { hitTestKind } from "./tv/kinds/hit-tests";
export { drawingAxisLabels, type PriceAxisLabel, type TimeAxisLabel } from "./tv/kinds/axis-labels";

// ============ Interaction rules ============
export { finishPlacement, buildNewDrawing } from "./tv/interact/placement";
export { applyDrag, anchorCursor, type DragState } from "./tv/interact/drag";

export const VERSION = "0.2.0-dev";
