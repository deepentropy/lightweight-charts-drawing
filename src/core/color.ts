/*
 * Colour helpers (moved from OpenTrader ColorPanel): a colour is a hex
 * (opacity 100) or an rgba() string; opacity in percent.
 */

export function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const n = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

export function parseColor(v: string): { hex: string; opacity: number } {
  if (/^rgba?\(/.test(v)) {
    const m = v.match(/[\d.]+/g);
    if (m && m.length >= 3) {
      const hex = "#" + m.slice(0, 3).map((x) => Number(x).toString(16).padStart(2, "0")).join("");
      return { hex: hex.toUpperCase(), opacity: m[3] != null ? Math.round(Number(m[3]) * 100) : 100 };
    }
  }
  return { hex: (v || "#000000").toUpperCase(), opacity: 100 };
}

export function applyOpacity(hex: string, opacity: number): string {
  if (opacity >= 100) return hex;
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${(opacity / 100).toFixed(2)})`;
}

/** TV colorFromBackground: black text on a light label (grey value
 *  0.199·R + 0.687·G + 0.114·B ≥ 150), white otherwise. */
export function textOnColor(bg: string): string {
  let r = 0, g = 0, b = 0;
  const m = bg.match(/^#([0-9a-f]{6})/i);
  if (m) {
    const n = parseInt(m[1], 16);
    r = n >> 16; g = (n >> 8) & 255; b = n & 255;
  } else {
    const c = bg.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
    if (c) { r = +c[1]; g = +c[2]; b = +c[3]; }
  }
  return 0.199 * r + 0.687 * g + 0.114 * b >= 150 ? "#000000" : "#ffffff";
}
