import { describe, expect, it } from 'vitest';
import { LEVELS } from './index';
import { SOLVE_DT, type Solution } from './solveRunner';
import { checkSolution } from './solutionCheck';
import { Loop } from '../engine/loop';

const files = import.meta.glob<Solution>('./solutions/*.json', { eager: true, import: 'default' });
const solutions = new Map(Object.entries(files).map(([p, s]) => [p.replace('./solutions/', '').replace('.json', ''), s]));

describe('Lösbarkeit', () => {
  it('mindestens die 8 Standard-Levels', () => expect(LEVELS.length).toBeGreaterThanOrEqual(8));
  it('simuliert mit demselben Takt wie das Spiel', () => expect(SOLVE_DT).toBe(Loop.STEP));

  for (const level of LEVELS) {
    describe(level.name, () => {
      it('hat eine Lösungsdatei', () => expect(solutions.has(level.id)).toBe(true));

      level.areas.forEach((_, area) => {
        it(`Abschnitt ${area + 1} kommt an`, () => {
          const sol = solutions.get(level.id);
          expect(sol).toBeDefined();
          const c = checkSolution(level, sol!).areas[area];
          expect(c.reason).toBeNull();
          expect(c.ok).toBe(true);
        });
      });
    });
  }
});
