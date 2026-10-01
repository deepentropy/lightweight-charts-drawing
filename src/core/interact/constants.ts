/*
 * Gesture constants of the drawing interaction (moved from OpenTrader
 * DrawingsOverlay, port phase 3).
 */

export const DRAG_THRESHOLD = 3;

/** TV interactionTolerance().minDistanceBetweenPoints (mouse): a click this
 *  close to the last / first vertex finishes a path / polyline; dragging a
 *  polyline end this close to the other end closes it. */
export const MIN_DISTANCE_BETWEEN_POINTS = 5;

/** Freehand (brush/highlighter) pointer-move sampling: append a new vertex only
 *  once the cursor has travelled this many screen-px from the last sample, so the
 *  stroke stays smooth without an unbounded point count. */
export const FREEHAND_SAMPLE_PX = 2;
