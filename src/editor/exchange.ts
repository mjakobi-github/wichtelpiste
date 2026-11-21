import type { LevelData } from '../sim/types';
import type { Solution } from '../levels/solveRunner';
import { validateLevel } from '../levels/schema';

const FORMAT = 'wichtelpiste-level';

/** Datei zum Weitergeben: Level + (optional) Lösung. */
export function exportFile(level: LevelData, solution: Solution | null): string {
  return JSON.stringify({ format: FORMAT, version: 1, level, solution }, null, 2) + '\n';
}

function readSolution(v: unknown): Solution | null {
  if (!v || typeof v !== 'object' || !Array.isArray((v as Solution).areas)) return null;
  return v as Solution;
}

/** Liest eine Export-Datei oder eine nackte Level-Datei; wirft mit deutscher Meldung. */
export function importFile(text: string): { level: LevelData; solution: Solution | null } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Keine gültige JSON-Datei');
  }
  if (raw && typeof raw === 'object' && (raw as { format?: unknown }).format === FORMAT) {
    const o = raw as { level: unknown; solution: unknown };
    return { level: validateLevel(o.level, 'Datei'), solution: readSolution(o.solution) };
  }
  return { level: validateLevel(raw, 'Datei'), solution: null };
}
