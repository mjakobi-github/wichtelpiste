import { describe, expect, it } from 'vitest';
import { LEVELS, LEVEL_FILES } from './index';
import { checkSolution, strokeLength } from './solutionCheck';
import type { Solution } from './solveRunner';
import type { LevelData } from '../sim/types';
import { validateLevel } from './schema';
import footOnlyJson from './fixtures/nur-zu-fuss.json';

const files = import.meta.glob<Solution>('./solutions/*.json', { eager: true, import: 'default' });
const sol = (id: string): Solution => files[`./solutions/${id}.json`];

describe('checkSolution', () => {
  it('alle Menü-Levels sind mit ihrer Lösung ok', () => {
    for (const l of LEVELS) expect(checkSolution(l, sol(l.id)).ok, l.id).toBe(true);
  });

  it('ohne Lösung: nicht ok, Grund „keine Lösung“', () => {
    const r = checkSolution(LEVELS[0], null);
    expect(r.ok).toBe(false);
    expect(r.areas[0].reason).toContain('keine Lösung');
  });

  it('Landezone außer Reichweite → Abschnitt scheitert', () => {
    const l = structuredClone(LEVELS[0]);
    l.dismounts[0] = { ...l.dismounts[0], y: 100 };
    const r = checkSolution(l, sol(l.id));
    expect(r.ok).toBe(false);
    expect(r.areas[0].ok).toBe(false);
    expect(r.areas[0].reason).toMatch(/^Abschnitt 1: /);
  });

  it('mehr Tinte erlaubt → weiterhin ok', () => {
    const l = structuredClone(LEVELS[0]);
    const ink = l.areas[0].ink;
    l.areas[0].ink = typeof ink === 'number' ? ink * 2 : ink;
    expect(checkSolution(l, sol(l.id)).ok).toBe(true);
  });

  it('misst verbrauchte Tinte je Art', () => {
    const r = checkSolution(LEVELS[0], sol(LEVELS[0].id));
    expect(r.areas[0].inkUsed).toBeGreaterThan(0);
    expect(r.areas[0].boostUsed).toBe(0);
    expect(strokeLength([[0, 0], [30, 40]])).toBe(50);
  });
});

describe('checkSolution ohne Abschnitte (reines Jump\'n\'Run)', () => {
  const footOnly = (): LevelData => validateLevel(structuredClone(footOnlyJson), 'Level');

  it('ok, wenn der Schornstein zu Fuß mit Geschenk erreichbar ist – auch ohne gemerkte Lösung', () => {
    expect(checkSolution(footOnly(), null).ok).toBe(true);
    expect(checkSolution(footOnly(), { areas: [] }).ok).toBe(true);
  });

  it('nicht ok, wenn der Schornstein zu Fuß unerreichbar ist; Grund wird genannt', () => {
    const l = footOnly();
    l.platforms.push({ x: 2200, y: 150, w: 200, h: 24 }); // Schornstein auf einem Balken 550 px über dem Boden
    l.chimney = { x: 2290, y: 150 };
    const r = checkSolution(l, null);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('zu Fuß');
  });
});

describe('LEVEL_FILES', () => {
  it('entspricht LEVELS mit Dateinamen', () => {
    expect(LEVEL_FILES.map((f) => f.level)).toEqual(LEVELS);
    for (const f of LEVEL_FILES) expect(f.file).toMatch(/^[^/]+\.json$/);
  });
});
