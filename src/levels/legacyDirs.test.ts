import { describe, expect, it } from 'vitest';
import { LEVELS } from './index';
import { validateLevel } from './schema';
import { springBackLevel } from './testFixtures';
import { solveArea } from './autoSolve';
import { checkSolution } from './solutionCheck';
import type { Solution } from './solveRunner';
import { fixDirsForSolution, hasLegacyLeft, pinLegacyDirs } from './legacyDirs';

const sols = import.meta.glob<Solution>('./solutions/*.json', { eager: true, import: 'default' });

/** Eine Lösung, wie sie früher gemerkt wurde: nach rechts zur Feder (die alte Nachprüfung startete immer rechts). */
function oldSpringBack(): { level: ReturnType<typeof validateLevel>; sol: Solution } {
  const s = solveArea(validateLevel(springBackLevel(1), 'x'), 0);
  return { level: validateLevel(springBackLevel(), 'x'), sol: { areas: [{ strokes: s.strokes! }] } };
}

describe('alte Level und die Fahrtrichtung der Station', () => {
  it('Spiel-Level 1–10: nichts zu ändern, Lösungen kommen an', () => {
    for (const l of LEVELS) {
      expect(hasLegacyLeft(l), l.id).toBe(false);
      expect(pinLegacyDirs(l)).toBe(l);
      const sol = sols[`./solutions/${l.id}.json`];
      expect(fixDirsForSolution(l, sol)).toBe(l);
      expect(checkSolution(l, sol).ok, l.id).toBe(true);
    }
  });

  it('eigenes Level, nach rechts zur Feder geschafft: bekommt „nach rechts“ und kommt weiter an', () => {
    const { level, sol } = oldSpringBack();
    expect(checkSolution(level, sol).ok).toBe(false); // ohne Umstellung kaputt
    const fixed = fixDirsForSolution(level, sol);
    expect(fixed.stations[0].dir).toBe(1);
    expect(checkSolution(fixed, sol).ok).toBe(true);
  });

  it('eigenes Level, das nach links geschafft wird: bleibt unverändert', () => {
    const l = LEVELS[0];
    const W = l.worldW;
    const level = { ...l, platforms: l.platforms.map((p) => ({ ...p, x: W - p.x - p.w })),
      stations: l.stations.map((s) => ({ pos: { x: W - s.pos.x, y: s.pos.y } })),
      dismounts: l.dismounts.map((d) => ({ ...d, x: W - d.x - d.w })), chimney: { x: W - l.chimney.x, y: l.chimney.y } };
    const orig = sols[`./solutions/${l.id}.json`];
    const sol: Solution = { areas: orig.areas.map((a) => ({ strokes: a.strokes.map((s) => ({ ...s, pts: s.pts.map(([x, y]) => [W - x, y] as [number, number]) })) })) };
    expect(fixDirsForSolution(level, sol)).toBe(level);
    expect(checkSolution(level, sol).ok).toBe(true);
  });

  it('ohne Lösung: eigenes Level bleibt unverändert; empfangenes bekommt den alten Rechtsstart', () => {
    const level = validateLevel(springBackLevel(), 'x');
    expect(fixDirsForSolution(level, null)).toBe(level);
    expect(pinLegacyDirs(level).stations[0].dir).toBe(1);
  });
});
