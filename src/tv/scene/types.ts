/*
 * Renderer-neutral drawing output ("scene"): what a tool draws, as plain data.
 * A host turns it into SVG (OpenTrader) or canvas calls (this library's pane
 * views). Items are drawn in order. Optional fields are left out of the
 * output when undefined, so a host can reproduce the exact markup.
 */
import type { Pt } from "../_shared";

/** Stroke / fill of a shape (SVG presentation attributes). */
export type Paint = {
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  /** SVG dash list ("4 2"); undefined = solid. */
  dash?: string;
  cap?: "round" | "butt" | "square";
  join?: "round" | "miter" | "bevel";
  fill?: string;
  fillOpacity?: number;
  fillRule?: "evenodd" | "nonzero";
  /** Name of a `radialGradient` item used as the fill (instead of `fill`). */
  fillRef?: string;
  /** Drop shadow under the shape (rect, path, circle). */
  shadow?: Shadow;
};

/** Drop shadow (CSS drop-shadow / canvas shadow*): offset, blur in px. */
export type Shadow = { dx: number; dy: number; blur: number; color: string };

/** Fields every drawn item can carry. */
export type ItemBase = {
  /** Name of a `clip` item: the item is drawn minus its cut-out polygons. */
  clip?: string;
  /** Not a pointer target (SVG pointer-events="none"). */
  inert?: boolean;
};

export type SceneItem =
  | ({ t: "line"; a: Pt; b: Pt } & Paint & ItemBase)
  | ({ t: "polyline"; pts: Pt[] } & Paint & ItemBase)
  | ({ t: "polygon"; pts: Pt[] } & Paint & ItemBase)
  /** `crisp`: pixel-aligned edges, no anti-aliasing (SVG crispEdges). */
  | ({ t: "path"; d: string; transform?: string; crisp?: boolean } & Paint & ItemBase)
  | ({ t: "rect"; x: number; y: number; w: number; h: number; rx?: number; ry?: number } & Paint & ItemBase)
  /** `cursor`: pointer cursor over the circle (a DOM host sets it). */
  | ({ t: "circle"; cx: number; cy: number; r: number; cursor?: string } & Paint & ItemBase)
  | ({ t: "ellipse"; cx: number; cy: number; rx: number; ry: number; transform?: string } & Paint & ItemBase)
  | ({
      t: "text";
      x: number;
      y: number;
      text: string;
      size: number;
      /** Undefined = the host default (black). */
      fill?: string;
      opacity?: number;
      anchor?: "start" | "middle" | "end";
      baseline?: "central" | "hanging" | "middle" | "alphabetic";
      weight?: number | "bold";
      fontStyle?: "normal" | "italic";
      family?: string;
      /** Keep spaces (white-space: pre). */
      pre?: boolean;
    } & ItemBase)
  /** `stretch`: fill the box, aspect ratio not kept. */
  | ({ t: "image"; href: string; x: number; y: number; w: number; h: number; opacity?: number; stretch?: boolean } & ItemBase)
  /** Items drawn together (a rotation / translation, a clip, an opacity, not
   *  a pointer target). */
  | ({ t: "group"; items: SceneItem[]; transform?: string; opacity?: number } & ItemBase)
  /** Icon glyph (an emoji / font character, or raw `<svg>` markup) in a
   *  size x size box at (x, y), painted in `color`. */
  | ({ t: "glyph"; x: number; y: number; size: number; glyph: string; color: string } & ItemBase)
  /** Cut-out region: every item naming it is drawn outside the polygons
   *  (TV addExclusionArea, even-odd). Draws nothing itself. */
  | { t: "clip"; name: string; polys: Pt[][] }
  /** Keep-inside clip: every item naming it is drawn inside the rectangle
   *  (e.g. Gann square arcs cut at the box). `idPrefix` names the host's
   *  clip id. Draws nothing itself. */
  | { t: "clipRect"; name: string; x: number; y: number; w: number; h: number; idPrefix?: string }
  /** Radial gradient in screen units: every item naming it in `fillRef` is
   *  filled with it. `idPrefix` names the host's gradient id. Draws nothing
   *  itself. */
  | {
      t: "radialGradient";
      name: string;
      cx: number;
      cy: number;
      r: number;
      stops: { offset: number; color: string; opacity: number }[];
      idPrefix?: string;
    }
  /** Invisible pointer target (a host with DOM hit testing draws it
   *  transparent; a canvas host skips it). */
  | { t: "hit"; a: Pt; b: Pt; width: number }
  /** Invisible curved pointer target (SVG path syntax). */
  | { t: "hitPath"; d: string; width: number }
  /** Anchor handles (TV LineAnchorRenderer; the host draws them). `squares`
   *  = indexes of one-axis anchors drawn as rounded squares. */
  | { t: "anchors"; pts: Pt[]; squares?: readonly number[] };

export type Scene = SceneItem[];
