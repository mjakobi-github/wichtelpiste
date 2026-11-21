import type { LevelData } from '../sim/types';
import { validateLevel } from './schema';

/** Alle Level-Dateien `src/levels/*.json`, nach Dateiname sortiert und validiert. */
const files = import.meta.glob<unknown>('./*.json', { eager: true, import: 'default' });

export const LEVELS: readonly LevelData[] = Object.keys(files)
  .sort()
  .map((path) => validateLevel(files[path], path.replace('./', '')));
