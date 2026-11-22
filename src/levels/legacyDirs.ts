import type { LevelData } from '../sim/types';
import { stationDir } from '../sim/elements';
import { checkSolution } from './solutionCheck';
import type { Solution } from './solveRunner';

/**
 * Früher fuhr der Schlitten in Blickrichtung der Elfe los, die Nachprüfung (Teilen, ✓ im Editor)
 * startete immer nach rechts. Heute gibt die Station die Richtung vor, ohne Angabe zum Ziel hin.
 * Unterschied gibt es nur bei Abschnitten, deren Ziel links liegt und die keine Richtung haben.
 */
const legacyLeft = (l: LevelData, i: number): boolean => l.stations[i].dir === undefined && stationDir(l, i) === -1;

/** Hat das Level Abschnitte, die sich durch die neue Regel anders verhalten können? */
export function hasLegacyLeft(l: LevelData): boolean {
  return l.stations.some((_, i) => legacyLeft(l, i));
}

const withDir = (l: LevelData, i: number, dir: 1 | -1): LevelData =>
  ({ ...l, stations: l.stations.map((s, k) => (k === i ? { ...s, dir } : s)) });

/**
 * Für Level, die mit der alten Nachprüfung geprüft wurden (geteilte Links, empfangene Level):
 * dort ist der Schlitten nach rechts gestartet – das wird festgeschrieben.
 */
export function pinLegacyDirs(l: LevelData): LevelData {
  let out = l;
  l.stations.forEach((_, i) => { if (legacyLeft(l, i)) out = withDir(out, i, 1); });
  return out;
}

/**
 * Für eigene Level mit gemerkter Lösung: Kommt die Lösung mit der neuen Regel nicht mehr an,
 * aber mit dem alten Rechtsstart, wird „nach rechts“ eingetragen. Sonst bleibt alles, wie es ist.
 */
export function fixDirsForSolution(l: LevelData, sol: Solution | null): LevelData {
  if (!sol || !hasLegacyLeft(l)) return l;
  let out = l;
  const now = checkSolution(l, sol);
  l.stations.forEach((_, i) => {
    if (!legacyLeft(l, i) || now.areas[i]?.ok || !sol.areas[i]?.strokes.length) return;
    const right = withDir(out, i, 1);
    if (checkSolution(right, sol).areas[i]?.ok) out = right;
  });
  return out;
}
