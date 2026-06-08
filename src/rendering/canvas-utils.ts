import type { Point, DrawingStyle, ControlPoint } from '../core/types';

/**
 * Set up canvas context with drawing style
 */
export function applyStyle(
  ctx: CanvasRenderingContext2D,
  style: DrawingStyle,
  pixelRatio: number = 1
): void {
  ctx.strokeStyle = style.lineColor;
  ctx.lineWidth = style.lineWidth * pixelRatio;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (style.lineDash && style.lineDash.length > 0) {
    ctx.setLineDash(style.lineDash.map((d) => d * pixelRatio));
  } else {
    ctx.setLineDash([]);
  }

  if (style.fillColor) {
    ctx.fillStyle = style.fillColor;
  }
}

/**
 * Draw a line between two points
 */
export function drawLine(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  pixelRatio: number = 1
): void {
  ctx.beginPath();
  ctx.moveTo(start.x * pixelRatio, start.y * pixelRatio);
  ctx.lineTo(end.x * pixelRatio, end.y * pixelRatio);
  ctx.stroke();
}

/**
 * Draw a dashed line between two points
 */
export function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  dashPattern: number[] = [5, 5],
  pixelRatio: number = 1
): void {
  ctx.save();
  ctx.setLineDash(dashPattern.map((d) => d * pixelRatio));
  drawLine(ctx, start, end, pixelRatio);
  ctx.restore();
}

/**
 * Draw a control point (anchor handle) in TradingView style:
 * dark filled center with a colored ring.
 */
export function drawControlPoint(
  ctx: CanvasRenderingContext2D,
  point: ControlPoint,
  isActive: boolean = false,
  pixelRatio: number = 1,
  lineColor: string = '#2962FF'
): void {
  const x = point.x * pixelRatio;
  const y = point.y * pixelRatio;
  // Visual radius driven by the control point's own radius (configurable via
  // setDrawingConfig({ controlPointRadius })). Falls back to 4 if unset.
  const r = point.radius ?? 4;
  const radius = r * pixelRatio;
  const ringWidth = Math.max(1.5, r * 0.25) * pixelRatio;

  // Dark filled center
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#131722';
  ctx.fill();

  // Colored ring
  ctx.beginPath();
  ctx.arc(x, y, radius - ringWidth / 2, 0, Math.PI * 2);
  ctx.strokeStyle = isActive ? '#ffffff' : lineColor;
  ctx.lineWidth = ringWidth;
  ctx.stroke();
}

/**
 * Draw all control points for a drawing
 */
export function drawControlPoints(
  ctx: CanvasRenderingContext2D,
  points: ControlPoint[],
  activeIndex: number | null = null,
  pixelRatio: number = 1,
  lineColor: string = '#2962FF'
): void {
  for (const point of points) {
    drawControlPoint(ctx, point, point.index === activeIndex, pixelRatio, lineColor);
  }
}

/**
 * Draw an arrow head at the end of a line
 */
export function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  size: number = 10,
  pixelRatio: number = 1
): void {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const arrowSize = size * pixelRatio;

  const x = to.x * pixelRatio;
  const y = to.y * pixelRatio;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(
    x - arrowSize * Math.cos(angle - Math.PI / 6),
    y - arrowSize * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(x, y);
  ctx.lineTo(
    x - arrowSize * Math.cos(angle + Math.PI / 6),
    y - arrowSize * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}

/**
 * Draw a filled arrow head
 */
export function drawFilledArrowHead(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  size: number = 10,
  pixelRatio: number = 1
): void {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const arrowSize = size * pixelRatio;

  const x = to.x * pixelRatio;
  const y = to.y * pixelRatio;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(
    x - arrowSize * Math.cos(angle - Math.PI / 6),
    y - arrowSize * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    x - arrowSize * Math.cos(angle + Math.PI / 6),
    y - arrowSize * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw a circle
 */
export function drawCircle(
  ctx: CanvasRenderingContext2D,
  center: Point,
  radius: number,
  fill: boolean = false,
  pixelRatio: number = 1
): void {
  ctx.beginPath();
  ctx.arc(
    center.x * pixelRatio,
    center.y * pixelRatio,
    radius * pixelRatio,
    0,
    Math.PI * 2
  );

  if (fill) {
    ctx.fill();
  }
  ctx.stroke();
}

/**
 * Draw a rectangle
 */
export function drawRect(
  ctx: CanvasRenderingContext2D,
  topLeft: Point,
  width: number,
  height: number,
  fill: boolean = false,
  pixelRatio: number = 1
): void {
  const x = topLeft.x * pixelRatio;
  const y = topLeft.y * pixelRatio;
  const w = width * pixelRatio;
  const h = height * pixelRatio;

  if (fill) {
    ctx.fillRect(x, y, w, h);
  }
  ctx.strokeRect(x, y, w, h);
}

/**
 * Draw text at a position
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  position: Point,
  font: string = '12px sans-serif',
  color: string = '#000000',
  align: CanvasTextAlign = 'left',
  baseline: CanvasTextBaseline = 'middle',
  pixelRatio: number = 1
): void {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, position.x * pixelRatio, position.y * pixelRatio);
  ctx.restore();
}

/**
 * Draw a label with background
 */
export function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  position: Point,
  style: {
    font?: string;
    textColor?: string;
    backgroundColor?: string;
    padding?: number;
    borderRadius?: number;
  } = {},
  pixelRatio: number = 1
): void {
  const {
    font = '12px sans-serif',
    textColor = '#ffffff',
    backgroundColor = 'rgba(0, 0, 0, 0.7)',
    padding = 4,
    borderRadius = 3,
  } = style;

  ctx.save();
  ctx.font = font;

  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = parseInt(font.match(/(\d+)px/)?.[1] ?? '12');

  const x = position.x * pixelRatio;
  const y = position.y * pixelRatio;
  const pad = padding * pixelRatio;
  const radius = borderRadius * pixelRatio;

  // Draw background
  ctx.fillStyle = backgroundColor;
  ctx.beginPath();
  ctx.roundRect(
    x - pad,
    y - textHeight / 2 - pad,
    textWidth + pad * 2,
    textHeight + pad * 2,
    radius
  );
  ctx.fill();

  // Draw text
  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);

  ctx.restore();
}

/**
 * Calculate price change percentage between two prices
 */
export function calculatePriceChange(startPrice: number, endPrice: number): {
  change: number;
  percentage: number;
} {
  const change = endPrice - startPrice;
  const percentage = startPrice !== 0 ? (change / startPrice) * 100 : 0;
  return { change, percentage };
}

/**
 * Format price for display. When precision is omitted, picks decimals based on
 * the price magnitude so sub-cent values don't render as "0.00".
 */
export function formatPrice(price: number, precision?: number): string {
  if (precision !== undefined) return price.toFixed(precision);
  const abs = Math.abs(price);
  if (abs === 0 || abs >= 1) return price.toFixed(2);
  if (abs >= 0.01) return price.toFixed(4);
  if (abs >= 0.0001) return price.toFixed(6);
  return price.toFixed(8);
}

/**
 * Format percentage for display
 */
export function formatPercentage(percentage: number, precision: number = 2): string {
  const sign = percentage >= 0 ? '+' : '';
  return `${sign}${percentage.toFixed(precision)}%`;
}
