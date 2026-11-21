/** Bildschirm-Fluss (rein, ohne DOM): Titel → Levelauswahl → Spiel ⇄ Pause → Sieg; Editor ⇄ Probespielen. */
export type Screen = 'title' | 'levels' | 'play' | 'pause' | 'won' | 'editor';
export type ScreenAction = 'start' | 'pickLevel' | 'pause' | 'resume' | 'restart' | 'toLevels' | 'win' | 'again' | 'next'
  | 'openEditor' | 'testPlay' | 'toEditor';

const FLOW: Record<Screen, Partial<Record<ScreenAction, Screen>>> = {
  title: { start: 'levels', openEditor: 'editor' },
  levels: { pickLevel: 'play' },
  play: { pause: 'pause', win: 'won', restart: 'play', toLevels: 'levels', toEditor: 'editor' },
  pause: { resume: 'play', restart: 'play', toLevels: 'levels', toEditor: 'editor' },
  won: { again: 'play', next: 'play', toLevels: 'levels', toEditor: 'editor' },
  editor: { testPlay: 'play', toLevels: 'levels' },
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
