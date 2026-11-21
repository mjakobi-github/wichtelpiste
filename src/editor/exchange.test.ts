import { describe, expect, it } from 'vitest';
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
});
