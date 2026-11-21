import type { LevelData } from '../sim/types';
import type { WinResult } from '../sim/events';
import { levelHash } from '../sim/scoring';

export interface LevelProgress { stars: 0 | 1 | 2 | 3; bestInk: number | null }

interface Entry { stars: 0 | 1 | 2 | 3; bestInk: number | null; hash: string }

type Store = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Sterne + Tinten-Bestwert je Level in localStorage (Best-Effort).
 * Bestwert zählt nur bei 3 Sternen; ändert sich ein Level (Hash), beginnt es neu.
 */
export class Progress {
  private data: Record<string, Entry> = {};

  constructor(private readonly storage: Store | null, private readonly key = 'schlittenfahrer.progress.v1') {
    try {
      const raw = storage?.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) this.data = parsed as Record<string, Entry>;
    } catch {
      this.data = {};
    }
  }

  /** key: eigener Schlüssel für eigene/geschenkte Levels (siehe progressKey), sonst level.id. */
  get(level: LevelData, key = level.id): LevelProgress {
    const e = this.data[key];
    if (!e || e.hash !== levelHash(level)) return { stars: 0, bestInk: null };
    return { stars: e.stars, bestInk: e.bestInk };
  }

  /**
   * Eintrag auf einen neuen Level-Stand umschreiben (z. B. nach großzügigerer Tinte): nur, wenn er zum alten Stand gehört.
   */
  rekey(from: LevelData, to: LevelData, key: string): void {
    const e = this.data[key];
    if (!e || e.hash !== levelHash(from)) return;
    this.data[key] = { ...e, hash: levelHash(to) };
    try { this.storage?.setItem(this.key, JSON.stringify(this.data)); } catch { /* Best-Effort */ }
  }

  record(level: LevelData, r: WinResult, key = level.id): { newBestInk: boolean; improvedStars: boolean } {
    const cur = this.get(level, key);
    const improvedStars = r.stars > cur.stars;
    const newBestInk = r.stars === 3 && (cur.bestInk === null || r.inkUsed < cur.bestInk);
    this.data[key] = {
      stars: improvedStars ? r.stars : cur.stars,
      bestInk: newBestInk ? r.inkUsed : cur.bestInk,
      hash: levelHash(level),
    };
    try {
      this.storage?.setItem(this.key, JSON.stringify(this.data));
    } catch {
      /* Speichern ist Best-Effort (Privatmodus, voll) */
    }
    return { newBestInk, improvedStars };
  }
}

/** Fortschritts-Schlüssel, die nie mit Menü-Level-IDs kollidieren. */
export const progressKey = {
  mine: (uid: string): string => `mine:${uid}`,
  gift: (key: string): string => `gift:${key}`,
};
