/** Eigene Inline-SVG-Icons (24×24, currentColor) statt Emoji. */
const S = 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';

const PATHS = {
  pencil: `<path ${S} d="M4 20l4-1L19 8a2.1 2.1 0 0 0-3-3L5 16z"/><path ${S} d="M14 7l3 3"/>`,
  rocket: `<path ${S} d="M12 3c4 2 6 6 5 11l-2 3H9l-2-3C6 9 8 5 12 3z"/><circle cx="12" cy="10" r="1.8" fill="currentColor"/><path ${S} d="M9 17l-2 4M15 17l2 4M12 18v3"/>`,
  eraser: `<path ${S} d="M8 20h12"/><path ${S} d="M4 15l9-9a2 2 0 0 1 3 0l3 3a2 2 0 0 1 0 3l-8 8H8z"/><path ${S} d="M9 10l5 5"/>`,
  hand: `<path ${S} d="M8 12V6a1.5 1.5 0 0 1 3 0v5V4.5a1.5 1.5 0 0 1 3 0V11V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5a6 6 0 0 1-5-2.7L3.6 15a1.5 1.5 0 0 1 2.4-1.8L8 15"/>`,
  undo: `<path ${S} d="M9 14L4 9l5-5"/><path ${S} d="M4 9h10a6 6 0 0 1 0 12h-3"/>`,
  trash: `<path ${S} d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>`,
  plus: `<path ${S} d="M12 5v14M5 12h14"/>`,
  minus: `<path ${S} d="M5 12h14"/>`,
  fullscreen: `<path ${S} d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>`,
  pause: `<path ${S} d="M9 5v14M15 5v14"/>`,
  play: `<path d="M8 5v14l11-7z" fill="currentColor"/>`,
  restart: `<path ${S} d="M4 12a8 8 0 1 0 2.5-5.8"/><path ${S} d="M4 4v5h5"/>`,
  levels: `<rect ${S} x="4" y="4" width="6" height="6" rx="1.5"/><rect ${S} x="14" y="4" width="6" height="6" rx="1.5"/><rect ${S} x="4" y="14" width="6" height="6" rx="1.5"/><rect ${S} x="14" y="14" width="6" height="6" rx="1.5"/>`,
  soundOn: `<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path ${S} d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>`,
  soundOff: `<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path ${S} d="M16 9l5 6M21 9l-5 6"/>`,
  star: `<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="currentColor"/>`,
  starEmpty: `<path ${S} d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/>`,
  trophy: `<path ${S} d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M8 20h8M9.5 17h5"/>`,
  gift: `<rect x="3.5" y="9" width="17" height="11" rx="1.5" fill="#e83350"/><rect x="2.5" y="7" width="19" height="4" rx="1" fill="#ff5a70"/><rect x="10.5" y="7" width="3" height="13" fill="#ffd27a"/><path d="M12 7C9 2 5 4 8 7zM12 7c3-5 7-3 4 0z" fill="#ffc23d"/>`,
  sled: `<path ${S} d="M3 17h15a3 3 0 0 0 3-3"/><path ${S} d="M6 17v-3M15 17v-3"/><rect x="4" y="9" width="14" height="5" rx="2" fill="currentColor"/>`,
  left: `<path d="M15 5l-8 7 8 7z" fill="currentColor"/>`,
  right: `<path d="M9 5l8 7-8 7z" fill="currentColor"/>`,
  jump: `<path ${S} d="M12 20V7M6 12l6-6 6 6M5 3h14"/>`,
  rotate: `<rect ${S} x="7" y="2" width="10" height="20" rx="2"/><path ${S} d="M11 18h2"/>`,
  finger: `<path d="M9 11V4.5a1.5 1.5 0 0 1 3 0V10l5.6 1.2a2 2 0 0 1 1.5 2.3l-1 5.2A3 3 0 0 1 15.2 21H11a3 3 0 0 1-2.4-1.2L5 15a1.6 1.6 0 0 1 2.4-2.1L9 14.5z" fill="#f4f8ff" stroke="#2a3a5e" stroke-width="1.3" stroke-linejoin="round"/>`,
  ink: `<path ${S} d="M4 18c4-8 8 4 16-6"/>`,
  redo: `<path ${S} d="M15 14l5-5-5-5"/><path ${S} d="M20 9H10a6 6 0 0 0 0 12h3"/>`,
  grid: `<path ${S} d="M4 9h16M4 15h16M9 4v16M15 4v16"/>`,
  pointer: `<path d="M6 3l12 9-5.5 1 3 6-2.5 1.2-3-6L6 18z" fill="currentColor"/>`,
  save: `<path ${S} d="M5 4h11l3 3v13H5z"/><path ${S} d="M8 4v5h7V4M8 20v-6h8v6"/>`,
  download: `<path ${S} d="M12 4v11M7 10l5 5 5-5M5 20h14"/>`,
  upload: `<path ${S} d="M12 16V5M7 10l5-5 5 5M5 20h14"/>`,
  settings: `<circle ${S} cx="12" cy="12" r="3"/><path ${S} d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>`,
  back: `<path ${S} d="M15 5l-7 7 7 7"/>`,
  copy: `<rect ${S} x="8" y="8" width="12" height="12" rx="2"/><path ${S} d="M4 16V5a1 1 0 0 1 1-1h11"/>`,
  check: `<path ${S} d="M5 12l5 5 9-10"/>`,
  warn: `<path ${S} d="M12 3l10 18H2z"/><path ${S} d="M12 10v5M12 18v.5"/>`,
  sketch: `<rect ${S} x="3" y="13" width="8" height="7" rx="1"/><rect ${S} x="13" y="9" width="8" height="11" rx="1"/><path ${S} d="M5 9l3-4 3 4"/>`,
  jumpArc: `<path ${S} d="M3 19c3-14 15-14 18 0" stroke-dasharray="3 3"/><path ${S} d="M2 19h5M17 19h5"/>`,
} as const;

export type IconName = keyof typeof PATHS;

export function icon(name: IconName, cls = ''): string {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name]}</svg>`;
}

/** Sternreihe: n gefüllt von 3. */
export function stars(n: number, cls = ''): string {
  let s = '';
  for (let i = 0; i < 3; i++) s += icon(i < n ? 'star' : 'starEmpty', `${cls} ${i < n ? 'on' : 'off'}`);
  return s;
}
