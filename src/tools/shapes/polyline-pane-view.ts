import type { IPrimitivePaneView, IPrimitivePaneRenderer } from 'lightweight-charts';
import type { CanvasRenderingTarget2D, BitmapCoordinatesRenderingScope } from 'fancy-canvas';

import type { Polyline } from './polyline';
import type { Point } from '../../core/types';
import { applyStyle, drawControlPoints } from '../../rendering/canvas-utils';
import { getDrawingConfig } from '../../core/config';

export class PolylinePaneView implements IPrimitivePaneView {
  private _renderer: PolylinePaneRenderer;

  constructor(drawing: Polyline) {
    this._renderer = new PolylinePaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class PolylinePaneRenderer implements IPrimitivePaneRenderer {
  private _drawing: Polyline;

  constructor(drawing: Polyline) {
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

    const options = this._drawing.polylineOptions;

    applyStyle(ctx, this._drawing.style, pixelRatio);

    // Draw the polyline
    ctx.beginPath();
    ctx.moveTo(points[0].x * pixelRatio, points[0].y * pixelRatio);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x * pixelRatio, points[i].y * pixelRatio);
    }

    ctx.stroke();

    // Draw vertex markers if enabled
    if (options.showVertices) {
      const vertexRadius = (options.vertexRadius ?? 4) * pixelRatio;
      ctx.fillStyle = this._drawing.style.lineColor || '#2962FF';

      for (const point of points) {
        ctx.beginPath();
        ctx.arc(
          point.x * pixelRatio,
          point.y * pixelRatio,
          vertexRadius,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      // Draw white center for visibility
      ctx.fillStyle = '#ffffff';
      const innerRadius = vertexRadius * 0.5;
      for (const point of points) {
        ctx.beginPath();
        ctx.arc(
          point.x * pixelRatio,
          point.y * pixelRatio,
          innerRadius,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

    // Draw control points if selected
    const state = this._drawing.state;
    if (state === 'selected' || state === 'editing') {
      const controlPoints = points.map((p, i) => ({
        index: i,
        x: p.x,
        y: p.y,
        radius: getDrawingConfig().controlPointRadius,
      }));
      drawControlPoints(ctx, controlPoints, null, pixelRatio);
    }
  }
}
