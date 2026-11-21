/** Bildschirm-Fluss (rein, ohne DOM): Titel → Levelauswahl → Spiel ⇄ Pause → Sieg. */
export type Screen = 'title' | 'levels' | 'play' | 'pause' | 'won';
export type ScreenAction = 'start' | 'pickLevel' | 'pause' | 'resume' | 'restart' | 'toLevels' | 'win' | 'again' | 'next';

const FLOW: Record<Screen, Partial<Record<ScreenAction, Screen>>> = {
  title: { start: 'levels' },
  levels: { pickLevel: 'play' },
  play: { pause: 'pause', win: 'won', restart: 'play', toLevels: 'levels' },
  pause: { resume: 'play', restart: 'play', toLevels: 'levels' },
  won: { again: 'play', next: 'play', toLevels: 'levels' },
};

export function nextScreen(s: Screen, action: ScreenAction): Screen {
  return FLOW[s][action] ?? s;
}

/** Pausieren nur im laufenden Spiel und nicht mehr nach dem Sieg (sonst ginge der Sieg verloren). */
export function canPause(s: Screen, won: boolean): boolean {
  return s === 'play' && !won;
}

/** Tintenwert für Anzeigen: „—“ ohne Wert, sonst Ganzzahl mit Tausenderpunkt. */
export function formatInk(n: number | null): string {
  if (n === null) return '—';
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
