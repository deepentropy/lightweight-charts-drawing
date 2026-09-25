/*
 * TV Table tool (line-tool-table, module 995743): one point (top-left), a grid
 * of cells whose sizes are screen px (the table moves with its point but does
 * not scale with zoom). Pure TS layout + the TV resize rules, shared by the
 * overlay renderer, the hit test and the drag code.
 */
import type { Drawing, DrawingStyle } from "../types";
import type { Pt } from "../_shared";
import { measureTextStyled, tvWordWrap } from "./tv-text";

/** TV table constants (enum T): CellPadding 8, CellBorderWidth 1,
 *  CellActiveLineWidth 2, CellDefaultWidth 120, CellDefaultHeight 0 (auto),
 *  TextDefaultSize 14, LineHeight 1.3. */
export const TABLE_PAD = 8;
export const TABLE_BORDER = 1;
export const TABLE_ACTIVE_LINE = 2;
export const TABLE_CELL_WIDTH = 120;
export const TABLE_LINE_HEIGHT = 1.3;
/** TV colorTvBlue500 (active cell border) and its 20% alpha (hovered edge). */
export const TABLE_ACTIVE_COLOR = "#2962ff";
export const TABLE_EDGE_COLOR = "rgba(41, 98, 255, 0.2)";
/** TV interactionTolerance().line for a mouse. */
export const TABLE_EDGE_TOL = 3;
/** TV ResizeVirtualAnchorBase: edge anchors are base + (row+1)·base + (col+1),
 *  row / col 0 = none (functions ae / re). */
export const TABLE_EDGE_BASE = 1024;

export type TableCellRef = [row: number, col: number];
export type TableEdge = { row: number | null; col: number | null };

export function tableEdgeIndex(e: TableEdge): number {
  return TABLE_EDGE_BASE + (e.row == null ? 0 : e.row + 1) * TABLE_EDGE_BASE + (e.col == null ? 0 : e.col + 1);
}
export function tableEdgeOf(index: number): TableEdge | null {
  if (index < TABLE_EDGE_BASE) return null;
  const t = index - TABLE_EDGE_BASE;
  const r = Math.floor(t / TABLE_EDGE_BASE);
  const c = t % TABLE_EDGE_BASE;
  return { row: r === 0 ? null : r - 1, col: c === 0 ? null : c - 1 };
}

export function tableCells(s: DrawingStyle): string[][] {
  return s.tableCells ?? [["", "", ""], ["", "", ""], ["", "", ""]];
}
export function tableColWidths(s: DrawingStyle): number[] {
  const n = tableCells(s)[0]?.length ?? 0;
  const w = s.tableColWidths ?? [];
  return Array.from({ length: n }, (_, i) => w[i] ?? TABLE_CELL_WIDTH);
}
export function tableRowHeightsStored(s: DrawingStyle): number[] {
  const n = tableCells(s).length;
  const h = s.tableRowHeights ?? [];
  return Array.from({ length: n }, (_, i) => h[i] ?? 0);
}
const fontSizeOf = (s: DrawingStyle) => s.fontSize ?? 14;
const zeroWidth = (fs: number) => measureTextStyled("0", fs, false, false);

/** TV H: minimum column width = width("0") + 2·padding + 2·border. */
export function tableMinColWidth(fs: number): number {
  return zeroWidth(fs) + 2 * TABLE_PAD + 2 * TABLE_BORDER;
}
/** TV W: minimum row height = fs + 2·padding + border. */
export function tableMinRowHeight(fs: number): number {
  return fs + 2 * TABLE_PAD + TABLE_BORDER;
}
/** TV I: the word-wrap width of a column. */
export function tableWrapWidth(colW: number, fs: number): number {
  return Math.max(colW - 2 * TABLE_PAD - 2 * TABLE_BORDER, zeroWidth(fs));
}
/** Wrapped lines of a cell (TV wordWrap: an empty text has no line). */
export function tableCellLines(text: string, colW: number, fs: number): string[] {
  if (text === "") return [];
  return tvWordWrap(text, fs, false, false, tableWrapWidth(colW, fs));
}
/** TV A: the height a cell text needs. */
function textHeight(n: number, fs: number): number {
  return n * fs + (n - 1) * fs * (TABLE_LINE_HEIGHT - 1) + 2 * TABLE_PAD + 2 * TABLE_BORDER;
}

/** TV rowHeights(): each row = max(stored, minimum, every cell text height);
 *  `mins` = max(minimum, text heights) (the resize floor). */
export function tableRowHeights(s: DrawingStyle, cells = tableCells(s), widths = tableColWidths(s)): { heights: number[]; mins: number[] } {
  const fs = fontSizeOf(s);
  const stored = tableRowHeightsStored(s);
  const mins: number[] = [];
  const heights = stored.map((h, r) => {
    let m = tableMinRowHeight(fs);
    for (let c = 0; c < widths.length; c++) m = Math.max(m, textHeight(tableCellLines(cells[r]?.[c] ?? "", widths[c], fs).length, fs));
    mins.push(m);
    return Math.max(h, m);
  });
  return { heights, mins };
}

export type TableLayout = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** Cell edges: xs[c]..xs[c+1] for column c, ys[r]..ys[r+1] for row r
   *  (TV D: cumulative from the point, each rounded). */
  xs: number[];
  ys: number[];
  cells: string[][];
  lines: string[][][];
  fs: number;
};

export function tableLayout(d: Drawing, p: Pt): TableLayout {
  const s = d.style;
  const fs = fontSizeOf(s);
  const cells = tableCells(s);
  const widths = tableColWidths(s);
  const { heights } = tableRowHeights(s, cells, widths);
  const xs = [Math.round(p.x)];
  let acc = 0;
  for (const w of widths) { acc += w; xs.push(Math.round(p.x + acc)); }
  const ys = [Math.round(p.y)];
  acc = 0;
  for (const h of heights) { acc += h; ys.push(Math.round(p.y + acc)); }
  const lines = cells.map((row) => row.map((t, c) => tableCellLines(t, widths[c], fs)));
  return { left: xs[0], top: ys[0], right: xs[xs.length - 1], bottom: ys[ys.length - 1], xs, ys, cells, lines, fs };
}

/** The 4 anchors (TV order TopLeft, BottomLeft, TopRight, BottomRight). */
export function tableAnchors(l: TableLayout): Pt[] {
  return [
    { x: l.left, y: l.top },
    { x: l.left, y: l.bottom },
    { x: l.right, y: l.top },
    { x: l.right, y: l.bottom },
  ];
}

/** TV renderer hitTest: while selected, a row bottom / column right edge
 *  (± line tolerance) is a resize anchor; then a cell (body, with its index);
 *  then the table box. */
export function tableHitCell(l: TableLayout, cur: Pt, selected: boolean): { edge: TableEdge } | { cell: TableCellRef } | null {
  if (selected) {
    let row: number | null = null;
    let col: number | null = null;
    if (cur.x >= l.left && cur.x <= l.right) {
      for (let r = 0; r < l.ys.length - 1; r++) if (Math.abs(cur.y - l.ys[r + 1]) <= TABLE_EDGE_TOL) { row = r; break; }
    }
    if (cur.y >= l.top && cur.y <= l.bottom) {
      for (let c = 0; c < l.xs.length - 1; c++) if (Math.abs(cur.x - l.xs[c + 1]) <= TABLE_EDGE_TOL) { col = c; break; }
    }
    if (row != null || col != null) return { edge: { row, col } };
  }
  for (let r = 0; r < l.ys.length - 1; r++) {
    for (let c = 0; c < l.xs.length - 1; c++) {
      if (cur.x >= l.xs[c] && cur.x <= l.xs[c + 1] && cur.y >= l.ys[r] && cur.y <= l.ys[r + 1]) return { cell: [r, c] };
    }
  }
  return null;
}

/** TV $e: scale `sizes` to `total`, keeping each at least its minimum
 *  (sizes already at their minimum stay fixed when shrinking). */
export function distributeSizes(sizes: number[], mins: number[], total: number): number[] {
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  let o = sum(sizes);
  let t = Math.max(total, sum(mins));
  if (o === t) return [...sizes];
  if (t < o) for (let i = 0; i < sizes.length; i++) if (sizes[i] === mins[i]) { o -= sizes[i]; t -= sizes[i]; }
  const k = t / o;
  const r = sizes.map((v, i) => Math.max(mins[i], v * k));
  return sum(r) > t + 0.01 ? distributeSizes(r, mins, total) : r;
}

/** The active cell of the selected table (blue 2px border), whether its text
 *  editor is open, and the hovered resize edge (host UI state; one table at
 *  a time, like TV). */
export type TableUi = { id: string; cell: TableCellRef | null; editing: boolean; edge: TableEdge | null };

// ── Cell operations (TV insertCells / removeCells) ──────────────────────────
export type TableOp = "row" | "column";

/** TV insertCells: a column right of the active cell (else at the end, width
 *  120) or a row below it (else at the end, auto height). */
export function tableInsert(s: DrawingStyle, op: TableOp, at: TableCellRef | null): Partial<DrawingStyle> {
  const cells = tableCells(s).map((r) => [...r]);
  const widths = tableColWidths(s);
  const heights = tableRowHeightsStored(s);
  const [r0, c0] = at ?? [cells.length - 1, (cells[0]?.length ?? 1) - 1];
  if (op === "row") {
    const i = r0 + 1;
    cells.splice(i, 0, new Array(widths.length).fill(""));
    heights.splice(i, 0, 0);
  } else {
    const i = c0 + 1;
    for (const row of cells) row.splice(i, 0, "");
    widths.splice(i, 0, TABLE_CELL_WIDTH);
  }
  return { tableCells: cells, tableColWidths: widths, tableRowHeights: heights };
}

/** TV isRemoveCellsAvailable: never removes the last row / column. */
export function tableCanRemove(s: DrawingStyle, op: TableOp): boolean {
  const cells = tableCells(s);
  return op === "row" ? cells.length > 1 : (cells[0]?.length ?? 0) > 1;
}

/** TV removeCells: drops the active cell's row / column; the active cell is
 *  clamped to the new grid. */
export function tableRemove(s: DrawingStyle, op: TableOp, at: TableCellRef): { patch: Partial<DrawingStyle>; cell: TableCellRef } {
  const cells = tableCells(s).map((r) => [...r]);
  const widths = tableColWidths(s);
  const heights = tableRowHeightsStored(s);
  const [r0, c0] = at;
  if (op === "row") {
    cells.splice(r0, 1);
    heights.splice(r0, 1);
  } else {
    for (const row of cells) row.splice(c0, 1);
    widths.splice(c0, 1);
  }
  const cell: TableCellRef = [Math.min(r0, cells.length - 1), Math.min(c0, widths.length - 1)];
  return { patch: { tableCells: cells, tableColWidths: widths, tableRowHeights: heights }, cell };
}

/** TV switchActiveCell: the next (Tab) / previous (Shift+Tab) cell, row-major,
 *  wrapping around the table. */
export function tableNextCell(s: DrawingStyle, at: TableCellRef, back: boolean): TableCellRef {
  const cells = tableCells(s);
  const cols = cells[0]?.length ?? 1;
  const n = cols * cells.length;
  const k = (at[0] * cols + at[1] + (back ? n - 1 : 1)) % n;
  return [Math.floor(k / cols) % cells.length, k % cols];
}

/** The same table with one cell's text replaced. */
export function tableWithText(s: DrawingStyle, at: TableCellRef, text: string): Partial<DrawingStyle> {
  const cells = tableCells(s).map((r) => [...r]);
  if (cells[at[0]]) cells[at[0]][at[1]] = text;
  return { tableCells: cells };
}
