import { describe, expect, it } from 'vitest';
import { LEVELS } from './index';
import { autoSolve, solveArea } from './autoSolve';
import { checkSolution } from './solutionCheck';
import { newLevel } from '../editor/template';

describe('autoSolve', () => {
  // Die Menü-Levels sind von Hand gelöst – der Löser muss sie mit ihrem Budget auch allein schaffen
  for (const l of LEVELS) {
    it(`löst ${l.id} ohne vorhandene Lösung im Budget`, () => {
      const r = autoSolve(l, null);
      const c = checkSolution(l, r.solution);
      expect(c.areas.map((a) => a.reason)).toEqual(l.areas.map(() => null));
    });
  }

  it('Vorlage „Neues Level“ ist lösbar', () => {
    const l = newLevel();
    expect(checkSolution(l, autoSolve(l, null).solution).ok).toBe(true);
  });

  it('Landezone höher als die Station, ohne Speedtinte: keine Piste, mit Grund', () => {
    const l = newLevel();
    l.platforms[1] = { ...l.platforms[1], y: 300, h: 420 };
    l.dismounts[0] = { x: 1300, y: 150, w: 240, h: 150 };
    const s = solveArea(l, 0);
    expect(s.strokes).toBeNull();
    expect(s.reason).toBeTruthy();
  });

  it('zu wenig Tinte: erst ohne Budget lösbar', () => {
    const l = newLevel();
    l.areas[0] = { ink: 100, boost: 0 };
    expect(solveArea(l, 0).strokes).toBeNull();
    const u = solveArea(l, 0, { unlimited: true });
    expect(u.strokes).not.toBeNull();
    expect(u.inkUsed).toBeGreaterThan(100);
  });

  it('behält eine gültige vorhandene Lösung', () => {
    const l = newLevel();
    const first = autoSolve(l, null).solution;
    const again = autoSolve(l, first);
    expect(again.solution).toEqual(first);
    expect(again.areas[0].tried).toBe(0);
  });
});
