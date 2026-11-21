import { describe, expect, it } from 'vitest';
import { planSave } from './savePlan';
import { LEVELS, LEVEL_FILES } from '../levels';
import type { Solution } from '../levels/solveRunner';

const sols = import.meta.glob<Solution>('../levels/solutions/*.json', { eager: true, import: 'default' });
const solOf = (id: string): Solution => sols[`../levels/solutions/${id}.json`];
const files = LEVEL_FILES.map((f) => f.file);
const base = LEVELS[0];

describe('planSave', () => {
  it('neues Level → nächste Nummer + Lösung', () => {
    const r = planSave({ level: { ...base, id: 'mein-level' }, solution: solOf(base.id) }, files);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const next = String(Math.max(...files.map((f) => parseInt(f, 10))) + 1).padStart(2, '0');
    expect(r.file).toBe(`${next}-mein-level.json`);
    expect(r.writes.map((w) => w.path)).toEqual([`src/levels/${next}-mein-level.json`, 'src/levels/solutions/mein-level.json']);
    expect(JSON.parse(r.writes[0].content).id).toBe('mein-level');
    expect(r.writes[0].content.endsWith('\n')).toBe(true);
  });

  it('böse ID → abgelehnt', () => {
    const r = planSave({ level: { ...base, id: '../x' }, solution: solOf(base.id) }, files);
    expect(r).toMatchObject({ ok: false });
  });

  it('ungültiges Level → Fehler mit Feldpfad', () => {
    const r = planSave({ level: { ...base, gifts: [] }, solution: solOf(base.id) }, files);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('gifts');
  });

  it('Lösung kommt nicht an → Fehler „Abschnitt …“', () => {
    const r = planSave({ level: { ...base, id: 'x-1', dismounts: [{ ...base.dismounts[0], y: 100 }] }, solution: solOf(base.id) }, files);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Abschnitt 1/);
  });

  it('vorhandene Datei wird genau überschrieben', () => {
    const f = LEVEL_FILES[0];
    const r = planSave({ level: f.level, solution: solOf(f.level.id), file: f.file }, files);
    expect(r.ok && r.writes[0].path).toBe(`src/levels/${f.file}`);
  });

  it('fremder oder böser Dateiname → abgelehnt', () => {
    expect(planSave({ level: base, solution: solOf(base.id), file: '../../x.json' }, files).ok).toBe(false);
    expect(planSave({ level: base, solution: solOf(base.id), file: LEVEL_FILES[1].file }, files).ok).toBe(false);
  });

  it('ID schon vergeben (ohne Datei) → abgelehnt', () => {
    const r = planSave({ level: base, solution: solOf(base.id) }, files);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('ID schon vergeben');
  });

  it('kein Objekt → abgelehnt', () => {
    expect(planSave(null, files).ok).toBe(false);
    expect(planSave({ level: {} }, files).ok).toBe(false);
  });
});
