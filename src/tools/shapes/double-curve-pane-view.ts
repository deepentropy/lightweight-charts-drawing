import type { IPrimitivePaneView, IPrimitivePaneRenderer } from 'lightweight-charts';
import type { CanvasRenderingTarget2D, BitmapCoordinatesRenderingScope } from 'fancy-canvas';

import type { DoubleCurve } from './double-curve';
import { applyStyle, drawControlPoints } from '../../rendering/canvas-utils';
import { getDrawingConfig } from '../../core/config';

export class DoubleCurvePaneView implements IPrimitivePaneView {
  private _renderer: DoubleCurvePaneRenderer;

  constructor(drawing: DoubleCurve) {
    this._renderer = new DoubleCurvePaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class DoubleCurvePaneRenderer implements IPrimitivePaneRenderer {
  private _drawing: DoubleCurve;

  constructor(drawing: DoubleCurve) {
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

    const mainPts = this._drawing.getMainPoints(viewport);
    const ctrlPts = this._drawing.getBezierControlPoints(viewport);
    if (!mainPts || !ctrlPts) return;

    const { start, middle, end } = mainPts;
    const { cp1, cp2, cp3, cp4 } = ctrlPts;
    const options = this._drawing.doubleCurveOptions;

    applyStyle(ctx, this._drawing.style, pixelRatio);

    // Draw control lines if enabled
    if (options.showControlPoints) {
      ctx.save();
      ctx.strokeStyle = this._drawing.style.lineColor || '#2962FF';
      ctx.globalAlpha = 0.3;
      ctx.setLineDash([4 * pixelRatio, 4 * pixelRatio]);
      ctx.lineWidth = 1 * pixelRatio;

      // First curve control lines
      ctx.beginPath();
      ctx.moveTo(start.x * pixelRatio, start.y * pixelRatio);
      ctx.lineTo(cp1.x * pixelRatio, cp1.y * pixelRatio);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cp2.x * pixelRatio, cp2.y * pixelRatio);
      ctx.lineTo(middle.x * pixelRatio, middle.y * pixelRatio);
      ctx.stroke();

      // Second curve control lines
      ctx.beginPath();
      ctx.moveTo(middle.x * pixelRatio, middle.y * pixelRatio);
      ctx.lineTo(cp3.x * pixelRatio, cp3.y * pixelRatio);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cp4.x * pixelRatio, cp4.y * pixelRatio);
      ctx.lineTo(end.x * pixelRatio, end.y * pixelRatio);
      ctx.stroke();

      ctx.restore();
    }

    // Draw the S-curve using two bezier curves
    applyStyle(ctx, this._drawing.style, pixelRatio);
    ctx.beginPath();
    ctx.moveTo(start.x * pixelRatio, start.y * pixelRatio);

    // First curve: start to middle
    ctx.bezierCurveTo(
      cp1.x * pixelRatio,
      cp1.y * pixelRatio,
      cp2.x * pixelRatio,
      cp2.y * pixelRatio,
      middle.x * pixelRatio,
      middle.y * pixelRatio
    );

    // Second curve: middle to end
    ctx.bezierCurveTo(
      cp3.x * pixelRatio,
      cp3.y * pixelRatio,
      cp4.x * pixelRatio,
      cp4.y * pixelRatio,
      end.x * pixelRatio,
      end.y * pixelRatio
    );

    ctx.stroke();

    // Draw control point markers if enabled
    if (options.showControlPoints) {
      const markerRadius = 3 * pixelRatio;
      ctx.fillStyle = this._drawing.style.lineColor || '#2962FF';
      ctx.globalAlpha = 0.5;

      for (const pt of [cp1, cp2, cp3, cp4]) {
        ctx.beginPath();
        ctx.arc(pt.x * pixelRatio, pt.y * pixelRatio, markerRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Draw anchor point markers
    const markerRadius = 4 * pixelRatio;
    ctx.fillStyle = this._drawing.style.lineColor || '#2962FF';

    for (const pt of [start, middle, end]) {
      ctx.beginPath();
      ctx.arc(pt.x * pixelRatio, pt.y * pixelRatio, markerRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw control points if selected
    const state = this._drawing.state;
    if (state === 'selected' || state === 'editing') {
      const controlPoints = [
        { index: 0, x: start.x, y: start.y, radius: getDrawingConfig().controlPointRadius },
        { index: 1, x: middle.x, y: middle.y, radius: getDrawingConfig().controlPointRadius },
        { index: 2, x: end.x, y: end.y, radius: getDrawingConfig().controlPointRadius },
      ];
      drawControlPoints(ctx, controlPoints, null, pixelRatio);
    }
  }
}
