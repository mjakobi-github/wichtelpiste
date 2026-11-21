import type { LevelData } from '../sim/types';
import { validateLevel } from '../levels/schema';

/** Lässt sich das Level spielen? Sonst eine kindgerechte Meldung (z. B. eigenes, unfertiges Level). */
export function playableError(level: LevelData): string | null {
  try {
    validateLevel(JSON.parse(JSON.stringify(level)), 'Level');
    return null;
  } catch {
    return 'Dieses Level ist noch nicht fertig – im Editor reparieren';
  }
}
