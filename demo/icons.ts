/* Demo toolbar icons (own drawings, 28 x 28, stroke = currentColor). */
const svg = (body: string) =>
  `<svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS: Record<string, string> = {
  cursor: svg('<path d="M9 5.5v15l4-3.8 2.6 5.8 2.2-1-2.6-5.7 5.6-.3z"/>'),
  "Trend tools": svg('<path d="M7.8 20.2 20.2 7.8"/><circle cx="6.5" cy="21.5" r="1.8"/><circle cx="21.5" cy="6.5" r="1.8"/>'),
  "Gann and Fibonacci tools": svg('<path d="M4.5 7h19M4.5 12h19M4.5 16.5h19M4.5 21h19"/><path d="M7 21 21 7" stroke-dasharray="2 2"/>'),
  Patterns: svg('<path d="m4.5 19 5-9 5 6 4.5-9.5 4.5 7"/><circle cx="4.5" cy="19" r="1.3"/><circle cx="9.5" cy="10" r="1.3"/><circle cx="14.5" cy="16" r="1.3"/><circle cx="19" cy="6.5" r="1.3"/><circle cx="23.5" cy="13.5" r="1.3"/>'),
  "Forecasting and measurement tools": svg('<rect x="5" y="5" width="18" height="8" rx="1"/><rect x="5" y="13" width="18" height="10" rx="1"/><path d="M5 13h18" stroke-width="1.6"/>'),
  "Geometric shapes": svg('<path d="M5.5 18c3-7 6.5 1 9.5-4.5S20 6 22.5 9"/><rect x="6" y="5" width="7" height="6" rx="1"/><circle cx="19" cy="20" r="3.5"/>'),
  "Annotation tools": svg('<path d="M7 7h14M14 7v15M11 22h6"/>'),
  emoji: svg('<circle cx="14" cy="14" r="8.5"/><path d="M10.5 16.2c1.8 2 5.2 2 7 0"/><circle cx="11" cy="12" r=".6" fill="currentColor"/><circle cx="17" cy="12" r=".6" fill="currentColor"/>'),
  magnet: svg('<path d="M8 6v8a6 6 0 0 0 12 0V6h-4v8a2 2 0 0 1-4 0V6z"/><path d="M8 9.5h4M16 9.5h4"/>'),
  keep: svg('<path d="m17.5 5.5 5 5L11 22H6v-5z"/><path d="m15 8 5 5"/>'),
  trash: svg('<path d="M6 8h16M11 8V5.5h6V8M8 8l1 14.5h10L20 8M12 12v7M16 12v7"/>'),
  download: svg('<path d="M14 5v12M9 12.5l5 5 5-5M6 22h16"/>'),
  upload: svg('<path d="M14 18V6M9 10.5l5-5 5 5M6 22h16"/>'),
  anchor: svg('<circle cx="14" cy="7.5" r="2.3"/><path d="M14 9.8V23M9.5 13h9M6.5 16.5c0 4 3.5 6.5 7.5 6.5s7.5-2.5 7.5-6.5"/>'),
  github: '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.71 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.83-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z"/></svg>',
};
