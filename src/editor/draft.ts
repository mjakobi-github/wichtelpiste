import type { LevelData } from '../sim/types';
import type { Solution } from '../levels/solveRunner';
import { validateLevel } from '../levels/schema';

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
      return { ...d, level: validateLevel(d.level, 'Entwurf'), file: d.file ?? null, camera: d.camera ?? null, solution: d.solution ?? null };
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
