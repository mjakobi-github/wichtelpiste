import type { LevelData } from '../sim/types';
import { validateLevel } from './schema';

/** Alle Level-Dateien `src/levels/*.json`, nach Dateiname sortiert und validiert. */
const files = import.meta.glob<unknown>('./*.json', { eager: true, import: 'default' });

/** Dateiname (z. B. `01-erste-fahrt.json`) und Level, in Menü-Reihenfolge. */
export const LEVEL_FILES: readonly { file: string; level: LevelData }[] = Object.keys(files)
  .sort()
  .map((path) => {
    const file = path.replace('./', '');
    return { file, level: validateLevel(files[path], file) };
  });

export const LEVELS: readonly LevelData[] = LEVEL_FILES.map((f) => f.level);
