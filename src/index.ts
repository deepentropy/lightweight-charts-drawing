/**
 * lightweight-charts-drawing
 *
 * Drawing tools plugin for TradingView's lightweight-charts library.
 * Provides professional-grade drawing tools including trend lines,
 * Fibonacci retracements, channels, and more.
 *
 * @packageDocumentation
 */

// ============ Core ============
export {
  // Base class
  Drawing,
  // Manager
  DrawingManager,
  // Types
  type Anchor,
  type Point,
  type DrawingStyle,
  type DrawingOptions,
  type DrawingState,
  type SerializedDrawing,
  type Viewport,
  type MouseEventData,
  type PixelToChartFn,
  type ChartToPixelFn,
  type SnapConfig,
  type DrawingToolDefinition,
  type DrawingCategory,
  type DrawingEventType,
  type DrawingEvent,
  type DrawingEventCallback,
  type IDrawing,
  type ControlPoint,
  // Constants
  DEFAULT_DRAWING_STYLE,
  // Global config (control point radius, …)
  getDrawingConfig,
  setDrawingConfig,
  type DrawingConfigOptions,
} from './core';

// ============ Geometry ============
export {
  // Types
  type Geometry,
  type LineGeometry,
  type ArcGeometry,
  type RectangleGeometry,
  type PolygonGeometry,
  type TextGeometry,
  // Utility functions
  distanceToLineSegment,
  distanceToLine,
  distanceBetweenPoints,
  isPointNear,
  extendLineToViewport,
  getLineAngle,
  getLineAngleDegrees,
  rotatePoint,
  midpoint,
  lerp,
} from './core/geometry';

// ============ Interaction ============
export {
  InteractionHandler,
  TwoPointInteractionHandler,
  ThreePointInteractionHandler,
  SinglePointInteractionHandler,
  type InteractionState,
  type InteractionConfig,
  type IInteractionHandler,
} from './interaction';

// ============ Rendering ============
export {
  // Canvas utilities
  applyStyle,
  drawLine,
  drawDashedLine,
  drawControlPoint,
  drawControlPoints,
  drawArrowHead,
  drawFilledArrowHead,
  drawCircle,
  drawRect,
  drawText,
  drawLabel,
  calculatePriceChange,
  formatPrice,
  formatPercentage,
  // Preview renderers
  PreviewRenderer,
  LinePreviewRenderer,
  HorizontalLinePreviewRenderer,
  VerticalLinePreviewRenderer,
  ThreePointPreviewRenderer,
  type IPreviewRenderer,
  // Pane view
  DrawingPaneView,
} from './rendering';

// ============ Line Tools ============
export {
  BaseLine,
  TrendLine,
  TrendLinePaneView,
  type TrendLineOptions,
  HorizontalLine,
  HorizontalLinePaneView,
  type HorizontalLineOptions,
  VerticalLine,
  VerticalLinePaneView,
  type VerticalLineOptions,
  Ray,
  RayPaneView,
  type RayOptions,
  Arrow,
  ArrowPaneView,
  type ArrowOptions,
  ExtendedLine,
  ExtendedLinePaneView,
  type ExtendedLineOptions,
  CrossLine,
  CrossLinePaneView,
  type CrossLineOptions,
  InfoLine,
  InfoLinePaneView,
  type InfoLineOptions,
  TrendAngle,
  TrendAnglePaneView,
  type TrendAngleOptions,
  HorizontalRay,
  HorizontalRayPaneView,
  type HorizontalRayOptions,
} from './tools/lines';

// ============ Shape Tools ============
export {
  Rectangle,
  RectanglePaneView,
  type RectangleOptions,
  RotatedRectangle,
  RotatedRectanglePaneView,
  type RotatedRectangleOptions,
  Circle,
  CirclePaneView,
  type CircleOptions,
  Triangle,
  TrianglePaneView,
  type TriangleOptions,
  PriceRange,
  PriceRangePaneView,
  type PriceRangeOptions,
  Ellipse,
  EllipsePaneView,
  type EllipseOptions,
  Arc,
  ArcPaneView,
  type ArcOptions,
  Path,
  PathPaneView,
  type PathOptions,
  Polyline,
  PolylinePaneView,
  type PolylineOptions,
  Curve,
  CurvePaneView,
  type CurveOptions,
  DoubleCurve,
  DoubleCurvePaneView,
  type DoubleCurveOptions,
} from './tools/shapes';

// ============ Channel Tools ============
export {
  ParallelChannel,
  ParallelChannelPaneView,
  type ParallelChannelOptions,
  RegressionTrend,
  RegressionTrendPaneView,
  type RegressionTrendOptions,
  FlatTopBottom,
  FlatTopBottomPaneView,
  type FlatTopBottomOptions,
  DisjointChannel,
  DisjointChannelPaneView,
  type DisjointChannelOptions,
  FibRetracement,
  FibRetracementPaneView,
  type FibRetracementOptions,
  FIBONACCI_LEVELS,
} from './tools/channels';

// ============ Fibonacci Tools ============
export {
  FibExtension,
  FibExtensionPaneView,
  type FibExtensionOptions,
  FIB_EXTENSION_LEVELS,
  FibChannel,
  FibChannelPaneView,
  type FibChannelOptions,
  FIB_CHANNEL_LEVELS,
  FibTimeZone,
  FibTimeZonePaneView,
  type FibTimeZoneOptions,
  FIB_TIME_INTERVALS,
  FibSpeedFan,
  FibSpeedFanPaneView,
  type FibSpeedFanOptions,
  FIB_SPEED_RATIOS,
  FibTimeExtension,
  FibTimeExtensionPaneView,
  type FibTimeExtensionOptions,
  FIB_TIME_EXTENSION_LEVELS,
  FibCircles,
  FibCirclesPaneView,
  type FibCirclesOptions,
  FIB_CIRCLE_LEVELS,
  FibSpiral,
  FibSpiralPaneView,
  type FibSpiralOptions,
  GOLDEN_RATIO,
  FibArcs,
  FibArcsPaneView,
  type FibArcsOptions,
  FIB_ARC_LEVELS,
  FibWedge,
  FibWedgePaneView,
  type FibWedgeOptions,
  FIB_WEDGE_LEVELS,
  Pitchfan,
  PitchfanPaneView,
  type PitchfanOptions,
  PITCHFAN_LEVELS,
} from './tools/fibonacci';

// ============ Pitchfork Tools ============
export {
  AndrewsPitchfork,
  AndrewsPitchforkPaneView,
  type AndrewsPitchforkOptions,
  SchiffPitchfork,
  SchiffPitchforkPaneView,
  type SchiffPitchforkOptions,
  ModifiedSchiffPitchfork,
  ModifiedSchiffPitchforkPaneView,
  type ModifiedSchiffPitchforkOptions,
  InsidePitchfork,
  InsidePitchforkPaneView,
  type InsidePitchforkOptions,
} from './tools/pitchforks';

// ============ Gann Tools ============
export {
  GannBox,
  GannBoxPaneView,
  type GannBoxOptions,
  GANN_LEVELS,
  GannFan,
  GannFanPaneView,
  type GannFanOptions,
  GANN_FAN_ANGLES,
  GannSquareFixed,
  GannSquareFixedPaneView,
  type GannSquareFixedOptions,
  GANN_SQUARE_LEVELS,
  GannSquare,
  GannSquarePaneView,
  type GannSquareOptions,
  GANN_SQUARE_DIVISIONS,
} from './tools/gann';

// ============ Forecasting Tools ============
export {
  LongPosition,
  LongPositionPaneView,
  type LongPositionOptions,
  ShortPosition,
  ShortPositionPaneView,
  type ShortPositionOptions,
  DateRange,
  DateRangePaneView,
  type DateRangeOptions,
  DatePriceRange,
  DatePriceRangePaneView,
  type DatePriceRangeOptions,
  Projection,
  ProjectionPaneView,
  type ProjectionOptions,
  Forecast,
  ForecastPaneView,
  type ForecastOptions,
  BarsPattern,
  BarsPatternPaneView,
  type BarsPatternOptions,
} from './tools/forecasting';

// ============ Annotation Tools ============
export {
  TextAnnotation,
  TextAnnotationPaneView,
  type TextAnnotationOptions,
  Callout,
  CalloutPaneView,
  type CalloutOptions,
  Brush,
  BrushPaneView,
  type BrushOptions,
  Highlighter,
  HighlighterPaneView,
  type HighlighterOptions,
  ArrowMarker,
  ArrowMarkerPaneView,
  type ArrowMarkerOptions,
  type ArrowDirection,
  ArrowMarkUp,
  ArrowMarkUpPaneView,
  type ArrowMarkUpOptions,
  ArrowMarkDown,
  ArrowMarkDownPaneView,
  type ArrowMarkDownOptions,
  AnchoredText,
  AnchoredTextPaneView,
  type AnchoredTextOptions,
  Note,
  NotePaneView,
  type NoteOptions,
  PriceNote,
  PriceNotePaneView,
  type PriceNoteOptions,
  PriceLabel,
  PriceLabelPaneView,
  type PriceLabelOptions,
  FlagMark,
  FlagMarkPaneView,
  type FlagMarkOptions,
  type FlagColor,
  Pin,
  PinPaneView,
  type PinOptions,
  Comment,
  CommentPaneView,
  type CommentOptions,
  Signpost,
  SignpostPaneView,
  type SignpostOptions,
  Table,
  TablePaneView,
  type TableOptions,
} from './tools/annotations';

// ============ Tool Registry ============
export {
  ToolRegistry,
  getToolRegistry,
  TOOL_DEFINITIONS,
} from './registry';

// ============ Version ============
export const VERSION = '0.1.0';
