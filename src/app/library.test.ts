import { describe, expect, it } from 'vitest';
import { Gifts, migrateStationDirs, MyLevels } from './library';
import { validateLevel } from '../levels/schema';
import { springBackLevel } from '../levels/testFixtures';
import { solveArea } from '../levels/autoSolve';
import { checkSolution } from '../levels/solutionCheck';
import { Progress, progressKey } from './progress';
import { newLevel } from '../editor/template';
import { LEVELS } from '../levels';
import { levelHash } from '../sim/scoring';

function mem() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

describe('MyLevels', () => {
  it('anlegen, laden, speichern, löschen; neueste zuerst', () => {
    const s = mem();
    const lib = new MyLevels(s);
    const a = lib.create({ ...newLevel(), name: 'A' }, null);
    const b = lib.create({ ...newLevel(), name: 'B' }, null);
    expect(new MyLevels(s).list().map((x) => x.level.name)).toEqual(['B', 'A']);
    expect(lib.save({ ...a, level: { ...a.level, name: 'A2' } }).ok).toBe(true);
    expect(new MyLevels(s).list()[0].level.name).toBe('A2');
    lib.remove(b.uid);
    expect(new MyLevels(s).list().map((x) => x.uid)).toEqual([a.uid]);
    expect(lib.get(a.uid)?.level.name).toBe('A2');
    expect(a.uid).not.toBe(b.uid);
  });

  it('voller Speicher → Fehler statt still', () => {
    const s = mem();
    const lib = new MyLevels({ ...s, setItem: () => { throw new Error('QuotaExceeded'); } });
    const r = lib.save({ uid: 'x', level: newLevel(), solution: null, updatedAt: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Speicher/);
  });

  it('alter Entwurf wird genau einmal übernommen', () => {
    const s = mem();
    s.setItem('wichtelpiste.editor.draft.v1', JSON.stringify({ level: { ...newLevel(), name: 'Alt' }, solution: null, file: null, camera: null }));
    const lib = new MyLevels(s);
    expect(lib.migrateDraft()?.level.name).toBe('Alt');
    expect(lib.migrateDraft()).toBeNull();
    expect(new MyLevels(s).list().length).toBe(1);
  });

  it('kaputte Daten → leere Liste', () => {
    const s = mem();
    s.setItem('wichtelpiste.mylevels.v1', '{kaputt');
    expect(new MyLevels(s).list()).toEqual([]);
  });
});

describe('Gifts', () => {
  it('gleiches Level zweimal → ein Eintrag mit neuem Absender', () => {
    const s = mem();
    const g = new Gifts(s);
    g.add(LEVELS[0], 'Oma', 500);
    const second = g.add(LEVELS[0], 'Opa', 400);
    const list = new Gifts(s).list();
    expect(list.length).toBe(1);
    expect(list[0]).toMatchObject({ from: 'Opa', challengeInk: 400, key: levelHash(LEVELS[0]) });
    expect(second.key).toBe(list[0].key);
    g.remove(second.key);
    expect(new Gifts(s).list()).toEqual([]);
  });
});

describe('Progress mit eigenen Schlüsseln', () => {
  it('Geschenk mit gleicher id wie ein Menü-Level stört dessen Rekord nicht', () => {
    const s = mem();
    const p = new Progress(s);
    p.record(LEVELS[0], { stars: 3, gifts: 5, giftTotal: 5, inkUsed: 500 });
    p.record(LEVELS[0], { stars: 3, gifts: 5, giftTotal: 5, inkUsed: 100 }, progressKey.gift('abc'));
    expect(p.get(LEVELS[0]).bestInk).toBe(500);
    expect(p.get(LEVELS[0], progressKey.gift('abc')).bestInk).toBe(100);
    expect(progressKey.mine('u1')).toBe('mine:u1');
  });
});

describe('Progress.rekey', () => {
  it('Rekord bleibt, wenn nur die Tinte großzügiger wird', () => {
    const s = mem();
    const p = new Progress(s);
    const a = newLevel();
    const b = { ...a, areas: [{ ink: 650, boost: 0 }] };
    p.record(a, { stars: 3, gifts: 1, giftTotal: 1, inkUsed: 412 }, progressKey.mine('u'));
    p.rekey(a, b, progressKey.mine('u'));
    expect(p.get(b, progressKey.mine('u'))).toEqual({ stars: 3, bestInk: 412 });
    // fremder Stand wird nicht übernommen
    p.rekey({ ...a, name: 'anders' }, { ...b, name: 'x' }, progressKey.mine('u'));
    expect(p.get({ ...b, name: 'x' }, progressKey.mine('u')).stars).toBe(0);
  });
});

describe('migrateStationDirs (Fahrtrichtung kommt von der Station)', () => {
  const win = { stars: 3 as const, gifts: 1, giftTotal: 1, inkUsed: 300 };

  it('eigenes und empfangenes Level mit altem Rechtsstart: Richtung eingetragen, Sterne bleiben, nur einmal', () => {
    const s = mem();
    const old = validateLevel(springBackLevel(), 'x');
    const strokes = solveArea(validateLevel(springBackLevel(1), 'x'), 0).strokes!;
    const sol = { areas: [{ strokes }] };
    const mine = new MyLevels(s).create(old, sol);
    const menu = new MyLevels(s).create(LEVELS[0], null);
    const gift = new Gifts(s).add(old, 'Oma', null);
    const p = new Progress(s);
    p.record(old, win, progressKey.mine(mine.uid));
    p.record(old, win, progressKey.gift(gift.key));

    migrateStationDirs(s, new Progress(s));

    const m = new MyLevels(s).get(mine.uid)!;
    expect(m.level.stations[0].dir).toBe(1);
    expect(checkSolution(m.level, m.solution).ok).toBe(true);
    expect(new MyLevels(s).get(menu.uid)!.level).toEqual(LEVELS[0]);
    const g = new Gifts(s).list()[0];
    expect(g.level.stations[0].dir).toBe(1);
    expect(g.key).toBe(levelHash(g.level));
    const after = new Progress(s);
    expect(after.get(m.level, progressKey.mine(mine.uid)).stars).toBe(3);
    expect(after.get(g.level, progressKey.gift(g.key)).stars).toBe(3);

    // zweiter Start: nichts mehr anfassen
    new MyLevels(s).save({ ...m, level: { ...m.level, stations: [{ pos: m.level.stations[0].pos }] } });
    migrateStationDirs(s, new Progress(s));
    expect(new MyLevels(s).get(mine.uid)!.level.stations[0].dir).toBeUndefined();
  });
});
