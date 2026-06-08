import type { IPrimitivePaneView, IPrimitivePaneRenderer } from 'lightweight-charts';
import type { CanvasRenderingTarget2D, BitmapCoordinatesRenderingScope } from 'fancy-canvas';

import type { Brush } from './brush';
import type { Point } from '../../core/types';
import { applyStyle, drawControlPoints } from '../../rendering/canvas-utils';
import { getDrawingConfig } from '../../core/config';

export class BrushPaneView implements IPrimitivePaneView {
  private _renderer: BrushPaneRenderer;

  constructor(drawing: Brush) {
    this._renderer = new BrushPaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class BrushPaneRenderer implements IPrimitivePaneRenderer {
  private _drawing: Brush;

  constructor(drawing: Brush) {
    this._drawing = drawing;
  }

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope: BitmapCoordinatesRenderingScope) => {
      this.drawImpl(scope);
    });
  }

  private drawImpl(scope: BitmapCoordinatesRenderingScope): void {
    const { context: ctx, horizontalPixelRatio } = scope;
    const pixelRatio = horizontalPixelRatio;

    const viewport = this._drawing.getViewport();
    if (!viewport) return;
    if (!this._drawing.options.visible) return;
    if (!this._drawing.isValid()) return;

    const anchors = this._drawing.anchors;
    const points: Point[] = [];
    for (const anchor of anchors) {
      const p = this._drawing.anchorToPixel(anchor, viewport);
      if (p) points.push(p);
    }

    if (points.length < 2) return;

    const options = this._drawing.brushOptions;
    const brushSize = (options.brushSize ?? 3) * pixelRatio;

    applyStyle(ctx, this._drawing.style, pixelRatio);
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw the path
    ctx.beginPath();
    ctx.moveTo(points[0].x * pixelRatio, points[0].y * pixelRatio);

    // Use quadratic curves for smoother lines
    for (let i = 1; i < points.length - 1; i++) {
      ctx.quadraticCurveTo(
        points[i].x * pixelRatio,
        points[i].y * pixelRatio,
        (points[i].x + points[i + 1].x) / 2 * pixelRatio,
        (points[i].y + points[i + 1].y) / 2 * pixelRatio
      );
    }

    // Last point
    if (points.length > 1) {
      ctx.lineTo(
        points[points.length - 1].x * pixelRatio,
        points[points.length - 1].y * pixelRatio
      );
    }

    ctx.stroke();

    // Draw control points if selected (only first and last for brush)
    const state = this._drawing.state;
    if (state === 'selected' || state === 'editing') {
      // Only show first and last control points for brush
      const controlPoints = [
        { index: 0, x: points[0].x, y: points[0].y, radius: getDrawingConfig().controlPointRadius },
        { index: points.length - 1, x: points[points.length - 1].x, y: points[points.length - 1].y, radius: getDrawingConfig().controlPointRadius },
      ];
      drawControlPoints(ctx, controlPoints, null, pixelRatio);
    }
  }
}
