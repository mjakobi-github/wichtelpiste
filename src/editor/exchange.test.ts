import { describe, expect, it } from 'vitest';
import { checkSolution } from '../levels/solutionCheck';
import { solveArea } from '../levels/autoSolve';
import { springBackLevel } from '../levels/testFixtures';
import { validateLevel } from '../levels/schema';
import { exportFile, importFile } from './exchange';
import { newLevel } from './template';
import { LEVELS } from '../levels';
const raw = LEVELS[0];

describe('Export/Import', () => {
  it('hin und zurück', () => {
    const sol = { areas: [{ strokes: [{ boost: false, pts: [[1, 2], [3, 4]] as [number, number][] }] }] };
    const r = importFile(exportFile(newLevel(), sol));
    expect(r.level).toEqual(newLevel());
    expect(r.solution).toEqual(sol);
  });
  it('nackte Level-Datei', () => {
    const r = importFile(JSON.stringify(raw));
    expect(r.level.id).toBe('erste-fahrt');
    expect(r.solution).toBeNull();
  });
  it('Unsinn wirft verständlich', () => {
    expect(() => importFile('{')).toThrow(/JSON/);
    expect(() => importFile('{"version":2}')).toThrow();
  });

  it('ältere Datei mit Lösung nach rechts zur Feder: Richtung wird eingetragen', () => {
    const strokes = solveArea(validateLevel(springBackLevel(1), 'x'), 0).strokes!;
    const text = JSON.stringify({ format: 'wichtelpiste-level', version: 1, level: springBackLevel(), solution: { areas: [{ strokes }] } });
    const r = importFile(text);
    expect(r.level.stations[0].dir).toBe(1);
    expect(checkSolution(r.level, r.solution).ok).toBe(true);
  });
});
