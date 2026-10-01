/*
 * Level helpers shared by the level tools (channels, fib, gann, pitchforks):
 * visible levels, background opacity, per-level stroke, extended segments.
 */
import { dashFor, type Pt } from "../_shared";
import type { DrawingStyle, LevelDef } from "../types";

/** The visible levels sorted by coefficient. */
export function activeLevels(s: DrawingStyle, fallback: LevelDef[]): LevelDef[] {
  return (s.levels ?? fallback).filter((l) => l.visible).slice().sort((x, y) => x.coeff - y.coeff);
}

/** Fill opacity between adjacent levels: TV `fillBackground` +
 *  `transparency` (default on at 80 → 0.2). 0 disables the fills. */
export function levelFillOpacity(s: DrawingStyle): number {
  if (s.fillBackground === false) return 0;
  return Math.max(0, Math.min(1, (100 - (s.transparency ?? 80)) / 100));
}

/** Per-level stroke width (TV level linewidth column), else the drawing's. */
export function levelWidth(lvl: LevelDef, s: DrawingStyle): number {
  return lvl.width ?? s.width;
}

/** Per-level dash (TV level linestyle column), else the drawing's. */
export function levelDash(lvl: LevelDef, s: DrawingStyle): string | undefined {
  return lvl.style ? dashFor({ ...s, lineStyle: lvl.style }) : dashFor(s);
}

/** A segment continued past its ends to beyond the pane (TV extendLeft /
 *  extendRight of channel lines). */
export function extendSeg(l: Pt, r: Pt, extL: boolean, extR: boolean, big: number): { l: Pt; r: Pt } {
  const dx = r.x - l.x, dy = r.y - l.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    l: extL ? { x: l.x - (dx / len) * big, y: l.y - (dy / len) * big } : l,
    r: extR ? { x: r.x + (dx / len) * big, y: r.y + (dy / len) * big } : r,
  };
}
