import type { LevelData } from '../sim/types';
import type { Solution } from '../levels/solveRunner';

export interface DraftData {
  level: LevelData;
  solution: Solution | null;
  /** Dateiname in src/levels, wenn das Level von dort geöffnet/gespeichert wurde */
  file: string | null;
  camera: { cx: number; cy: number; zoom: number } | null;
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const KEY = 'wichtelpiste.editor.draft.v1';

/** Entwurf des Editors im Browser (Best-Effort, übersteht Neuladen). */
export class Draft {
  constructor(private readonly store: Store | null) {}

  load(): DraftData | null {
    try {
      const raw = this.store?.getItem(KEY);
      if (!raw) return null;
      const d = JSON.parse(raw) as DraftData;
      // Bewusst ohne validateLevel: auch ein halbfertiger (ungültiger) Zwischenstand bleibt erhalten.
      const l = d?.level as unknown as Record<string, unknown> | undefined;
      const lists = ['platforms', 'stations', 'dismounts', 'gifts', 'checkpoints', 'icicles', 'candies', 'hazards', 'movers', 'springs', 'noDraw', 'areas', 'hints'];
      if (!l || l.version !== 1 || !lists.every((k) => Array.isArray(l[k])) || typeof l.spawn !== 'object' || typeof l.chimney !== 'object' || typeof l.theme !== 'object') return null;
      return { level: d.level, file: d.file ?? null, camera: d.camera ?? null, solution: d.solution ?? null };
    } catch {
      return null;
    }
  }

  save(d: DraftData): void {
    try { this.store?.setItem(KEY, JSON.stringify(d)); } catch { /* voll/Privatmodus */ }
  }

  clear(): void {
    try { this.store?.removeItem(KEY); } catch { /* egal */ }
  }
}
