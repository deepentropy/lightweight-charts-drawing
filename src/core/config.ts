/**
 * Global drawing configuration.
 *
 * Lets host applications tune visual constants that were previously hardcoded,
 * such as the radius of the control points (anchors) drawn when a drawing is
 * selected. Defaults preserve the original behavior (no visual change unless
 * explicitly configured).
 */
export interface DrawingConfigOptions {
  /** Radius in CSS pixels of the control point (anchor) handles. Default: 6. */
  controlPointRadius: number;
}

const config: DrawingConfigOptions = {
  controlPointRadius: 6,
};

/** Returns the current global drawing configuration. */
export function getDrawingConfig(): Readonly<DrawingConfigOptions> {
  return config;
}

/** Updates the global drawing configuration. Only provided keys are changed. */
export function setDrawingConfig(options: Partial<DrawingConfigOptions>): void {
  Object.assign(config, options);
}
