/*
 * Example: a text note anchored to a bar, and the user editing its text.
 * Checked in CI (test/skill-examples.test.ts and `npm run typecheck`).
 */
import { defaultStyleFor, type Drawing, type DrawingManager, type NewDrawing, type OHLC } from "lightweight-charts-drawing";

/**
 * A note on bar `index`: kind "note" has 2 points, the anchor (the dot, here on the bar's high)
 * and the label box (here `offset` price units above it, on the same bar). The text is the
 * drawing's `text` field, not `style.text` (that one is the label of the line tools).
 */
export function barNote(bars: readonly OHLC[], index: number, text: string, offset?: number): NewDrawing {
  const bar = bars[index];
  const dy = offset ?? (bar.high - bar.low || Math.abs(bar.high) * 0.01 || 1);
  return {
    kind: "note",
    points: [
      { time: bar.time, price: bar.high },
      { time: bar.time, price: bar.high + dy },
    ],
    text,
    style: { ...defaultStyleFor("note"), textColor: "#ffffff" },
  };
}

/**
 * A text tool placed (or double-clicked) by the user fires `textEdit` with the drawing and the
 * pane point to open an editor at. The library has no editor: the host asks for the text and
 * writes it back with `update`. `ask` stands for the host's editor.
 */
export function editTextOnPlacement(manager: DrawingManager, ask: (current: string) => string | null): () => void {
  return manager.on("textEdit", (d: Drawing) => {
    const text = ask(d.text ?? "");
    if (text != null) manager.update({ ...d, text });
  });
}
