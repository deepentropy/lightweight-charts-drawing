/**
 * lightweight-charts-drawing 0.2
 *
 * TradingView-style drawing tools for lightweight-charts v5, built on a shared
 * drawing core (src/core: tool model + TradingView factory defaults, hit tests,
 * placement / drag rules, renderer-neutral scenes) and a canvas runtime
 * (src/runtime: DrawingManager).
 *
 * @packageDocumentation
 */

// ============ Runtime ============
export { DrawingManager, type DrawingManagerEvents, type DrawingManagerOptions, type MagnetMode, type TableOp } from "./runtime/manager";
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
  type VolumeProfileStyle,
} from "./core/types";
export { OVERLAY_SPECS, defaultStyleFor, factoryStyleFor, findOverlaySpec, setDefaultStyleOverride, volumeProfileDefaults, volumeProfileStyle, type OverlaySpec } from "./core/specs";
export type { Coords, OHLC } from "./core/coords";
export type { Pt, HitResult } from "./core/_shared";
export { parseDrawings, migrateDrawing } from "./core/serialize";

// ============ Scenes and hit tests (hosts drawing their own way) ============
export { sceneOf, sceneLockedAnchors, type SceneContext } from "./core/scene";
export { fibLevelAt } from "./core/scene/fib";
export type { Scene, SceneItem, Paint, Shadow } from "./core/scene/types";
export { hitTestKind } from "./core/kinds/hit-tests";
export { drawingAxisLabels, type PriceAxisLabel, type TimeAxisLabel } from "./core/kinds/axis-labels";

// ============ Host hooks: images, tables ============
export { cacheImage, decodeImage, setImageReader, onImagesChanged, IMAGE_MAX_BYTES, IMAGE_MAX_SIDE, IMAGE_TYPES, type LoadedImage } from "./core/kinds/images";
export type { TableCellRef, TableUi } from "./core/kinds/table";

// ============ Interaction rules ============
export { finishPlacement, buildNewDrawing } from "./core/interact/placement";
export { applyDrag, anchorCursor, type DragState } from "./core/interact/drag";
export { ANCHORABLE_KINDS, isAnchorable, toggleAnchored } from "./core/interact/anchor";

// package.json version, set at build time (vite define).
export const VERSION: string = __VERSION__;
