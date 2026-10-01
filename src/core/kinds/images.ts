/*
 * Drawing images (TV Image tool). The image file lives in the app data folder
 * (Rust commands save_drawing_image / read_drawing_image, named by content
 * hash); the drawing stores only that name. This module loads each image
 * once into a blob URL + natural size cache; `imagesVersion()` bumps when an
 * image finishes loading so renderers re-read the cache.
 */
import type { Drawing } from "../types";
import type { Pt } from "../_shared";

export type LoadedImage = { url: string; width: number; height: number };

/** TV limits (line-tool-image module 117820): JPG, PNG or WEBP; 2 MB; images
 *  larger than 2000 x 2000 are not drawn. */
export const IMAGE_MAX_BYTES = 2_000_000;
export const IMAGE_MAX_SIDE = 2000;
export const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

const cache = new Map<string, LoadedImage | "loading" | "error">();

/** Host hooks: how to read a stored image (OpenTrader: its Rust command),
 *  and who to tell when an image finished loading (renderers re-read). */
let readImage: (name: string) => Promise<Blob> = () => Promise.reject(new Error("no image reader"));
const listeners = new Set<() => void>();
export function setImageReader(fn: (name: string) => Promise<Blob>): void {
  readImage = fn;
}
export function onImagesChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function changed(): void {
  for (const fn of listeners) fn();
}

/** MIME type of a stored image name (by extension). */
export const imageMimeOf = (name: string) => (name.endsWith(".png") ? "image/png" : name.endsWith(".webp") ? "image/webp" : "image/jpeg");

export function decodeImage(url: string): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ url, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = url;
  });
}

/** The loaded image for a stored name, or null while loading / on error
 *  (starts the load on first use). Read `imagesVersion()` to react. */
export function drawingImage(name: string | undefined): LoadedImage | null {
  if (!name) return null;
  const hit = cache.get(name);
  if (hit && hit !== "loading" && hit !== "error") return hit;
  if (!hit) {
    cache.set(name, "loading");
    void readImage(name)
      .then((blob) => decodeImage(URL.createObjectURL(blob)))
      .then(
        (img) => cache.set(name, img),
        (e) => {
          cache.set(name, "error");
          console.warn("[image] read failed:", e);
        },
      )
      .then(changed);
  }
  return null;
}

/** True when the stored file could not be read or decoded (TV removes an
 *  image drawing whose image fails to load). */
export function drawingImageFailed(name: string | undefined): boolean {
  return !!name && cache.get(name) === "error";
}

/** TV image box (module line-tool-image `_calculateBox`, origin Centre): the
 *  point is the image centre, the size is cssWidth x cssHeight screen px.
 *  `dx` is the transient x offset kept during a corner drag (TV dOffsetX).
 *  Null while the image is not loaded or larger than 2000 x 2000 (TV draws
 *  nothing then). */
export function imageBox(d: Drawing, c: Pt): { left: number; top: number; right: number; bottom: number } | null {
  const im = d.image;
  const img = drawingImage(im?.name);
  if (!im || !img || img.width > IMAGE_MAX_SIDE || img.height > IMAGE_MAX_SIDE) return null;
  const x = c.x + (im.dx ?? 0);
  return { left: x - im.cssWidth / 2, top: c.y - im.cssHeight / 2, right: x + im.cssWidth / 2, bottom: c.y + im.cssHeight / 2 };
}

/** The 4 anchors inset 1px (TV order LeftTop, RightTop, LeftBottom,
 *  RightBottom). */
export function imageAnchors(b: { left: number; top: number; right: number; bottom: number }): Pt[] {
  return [
    { x: b.left + 1, y: b.top + 1 },
    { x: b.right - 1, y: b.top + 1 },
    { x: b.left + 1, y: b.bottom - 1 },
    { x: b.right - 1, y: b.bottom - 1 },
  ];
}
/** Anchor direction from the centre (TV _correctOriginDirections). */
export const IMAGE_ANCHOR_DIRS: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

/** TV initial size: natural size scaled down to fit a quarter of the pane
 *  (time scale width / 4, pane height / 4), never scaled up, rounded. */
export function imageInitialSize(natW: number, natH: number, paneW: number, paneH: number): { cssWidth: number; cssHeight: number } {
  const k = Math.min(Math.min(1, paneW / 4 / natW), Math.min(1, paneH / 4 / natH));
  return { cssWidth: Math.round(k * natW), cssHeight: Math.round(k * natH) };
}

/** Put an image the host just stored into the cache (no reload). */
export function cacheImage(name: string, img: LoadedImage): void {
  if (!cache.has(name) || cache.get(name) === "error") cache.set(name, img);
  changed();
}
