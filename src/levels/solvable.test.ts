import { describe, expect, it } from 'vitest';
import { LEVELS } from './index';
import { runArea, type Solution } from './solveRunner';

const files = import.meta.glob<Solution>('./solutions/*.json', { eager: true, import: 'default' });
const solutions = new Map(Object.entries(files).map(([p, s]) => [p.replace('./solutions/', '').replace('.json', ''), s]));

describe('Lösbarkeit', () => {
  it('es gibt genau 8 Levels', () => expect(LEVELS.length).toBe(8));

  for (const level of LEVELS) {
    describe(level.name, () => {
      it('hat eine Lösungsdatei', () => expect(solutions.has(level.id)).toBe(true));

      level.areas.forEach((_, area) => {
        it(`Abschnitt ${area + 1} kommt an`, () => {
          const sol = solutions.get(level.id);
          expect(sol).toBeDefined();
          const r = runArea(level, sol!, area);
          expect(r.drawProblems).toEqual([]);
          for (const rest of [r.remaining.ink, r.remaining.boost]) if (rest !== 'unlimited') expect(rest).toBeGreaterThanOrEqual(0);
          const want = level.dismounts[area] ? 'arrive' : 'win';
          expect(r.outcome?.type, JSON.stringify(r.outcome)).toBe(want);
        });
      });
    });
  }
});
