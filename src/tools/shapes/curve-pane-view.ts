import type { IPrimitivePaneView, IPrimitivePaneRenderer } from 'lightweight-charts';
import type { CanvasRenderingTarget2D, BitmapCoordinatesRenderingScope } from 'fancy-canvas';

import type { Curve } from './curve';
import { applyStyle, drawControlPoints } from '../../rendering/canvas-utils';
import { getDrawingConfig } from '../../core/config';

export class CurvePaneView implements IPrimitivePaneView {
  private _renderer: CurvePaneRenderer;

  constructor(drawing: Curve) {
    this._renderer = new CurvePaneRenderer(drawing);
  }

  zOrder(): 'bottom' | 'normal' | 'top' {
    return 'normal';
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

class CurvePaneRenderer implements IPrimitivePaneRenderer {
  private _drawing: Curve;

  constructor(drawing: Curve) {
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

    const controlPts = this._drawing.getControlPointsPixels(viewport);
    if (!controlPts) return;

    const { start, control1, control2, end } = controlPts;
    const options = this._drawing.curveOptions;

    applyStyle(ctx, this._drawing.style, pixelRatio);

    // Draw control lines if enabled (before the curve)
    if (options.showControlLines) {
      ctx.save();
      ctx.strokeStyle = this._drawing.style.lineColor || '#2962FF';
      ctx.globalAlpha = 0.3;
      ctx.setLineDash([4 * pixelRatio, 4 * pixelRatio]);
      ctx.lineWidth = 1 * pixelRatio;

      // Start to control1
      ctx.beginPath();
      ctx.moveTo(start.x * pixelRatio, start.y * pixelRatio);
      ctx.lineTo(control1.x * pixelRatio, control1.y * pixelRatio);
      ctx.stroke();

      // Control2 to end
      ctx.beginPath();
      ctx.moveTo(control2.x * pixelRatio, control2.y * pixelRatio);
      ctx.lineTo(end.x * pixelRatio, end.y * pixelRatio);
      ctx.stroke();

      ctx.restore();
    }

    // Draw the bezier curve
    applyStyle(ctx, this._drawing.style, pixelRatio);
    ctx.beginPath();
    ctx.moveTo(start.x * pixelRatio, start.y * pixelRatio);
    ctx.bezierCurveTo(
      control1.x * pixelRatio,
      control1.y * pixelRatio,
      control2.x * pixelRatio,
      control2.y * pixelRatio,
      end.x * pixelRatio,
      end.y * pixelRatio
    );
    ctx.stroke();

    // Draw control point markers if showing control lines
    if (options.showControlLines) {
      const markerRadius = 4 * pixelRatio;
      ctx.fillStyle = this._drawing.style.lineColor || '#2962FF';

      // Control point 1 (hollow)
      ctx.beginPath();
      ctx.arc(control1.x * pixelRatio, control1.y * pixelRatio, markerRadius, 0, Math.PI * 2);
      ctx.strokeStyle = this._drawing.style.lineColor || '#2962FF';
      ctx.lineWidth = 2 * pixelRatio;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Control point 2 (hollow)
      ctx.beginPath();
      ctx.arc(control2.x * pixelRatio, control2.y * pixelRatio, markerRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fill();
    }

    // Draw control points if selected
    const state = this._drawing.state;
    if (state === 'selected' || state === 'editing') {
      const controlPoints = [
        { index: 0, x: start.x, y: start.y, radius: getDrawingConfig().controlPointRadius },
        { index: 1, x: control1.x, y: control1.y, radius: getDrawingConfig().controlPointRadius },
        { index: 2, x: control2.x, y: control2.y, radius: getDrawingConfig().controlPointRadius },
        { index: 3, x: end.x, y: end.y, radius: getDrawingConfig().controlPointRadius },
      ];
      drawControlPoints(ctx, controlPoints, null, pixelRatio);
    }
  }
}
