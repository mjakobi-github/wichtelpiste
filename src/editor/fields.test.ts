import { describe, expect, it } from 'vitest';
import { validateLevel } from '../levels/schema';
import { addElement, getElement } from './doc';
import { applyField, applyLevelField, fieldsFor, levelFields } from './fields';
import { newLevel } from './template';
import type { Mover } from '../sim/types';

describe('fieldsFor/applyField', () => {
  it('Amplitude in Grad angezeigt, rad gespeichert', () => {
    const b = addElement(newLevel(), 'mover', { x: 500, y: 300 }, 'bell');
    const l = applyField(b.level, b.ref, 'amplitude', 30);
    const m = getElement(l, b.ref) as Mover;
    expect(m.path.type === 'pendulum' && m.path.amplitude).toBeCloseTo(Math.PI / 6);
    expect(fieldsFor(l, b.ref).find((f) => f.key === 'amplitude')?.value).toBeCloseTo(30);
  });
  it('Bahn-Typ wechseln ergibt gültige Bahn', () => {
    const b = addElement(newLevel(), 'mover', { x: 500, y: 300 }, 'bell');
    const l = applyField(b.level, b.ref, 'pathType', 'circle');
    expect((getElement(l, b.ref) as Mover).path.type).toBe('circle');
    expect(() => validateLevel(JSON.parse(JSON.stringify(l)), 't')).not.toThrow();
  });
  it('Eis umschalten', () => {
    const l = applyField(newLevel(), { kind: 'platform', index: 0 }, 'ice', true);
    expect(l.platforms[0].ice).toBe(true);
  });
  it('jede Art hat Felder, und alle Werte lassen sich zurückschreiben', () => {
    let l = newLevel();
    for (const [k, v] of [['mover', 'crow'], ['spring'], ['icicle'], ['hazard', 'tinsel'], ['hint'], ['checkpoint'], ['noDraw'], ['dismount']] as const) {
      l = addElement(l, k, { x: 500, y: 300 }, v).level;
    }
    l = { ...l, dismounts: l.dismounts.slice(0, 1) };
    for (const ref of [{ kind: 'gift', index: 0 }, { kind: 'spawn', index: 0 }, { kind: 'station', index: 0 }, { kind: 'mover', index: 0 }, { kind: 'spring', index: 0 }, { kind: 'hint', index: 0 }] as const) {
      const fs = fieldsFor(l, ref);
      expect(fs.length, ref.kind).toBeGreaterThan(0);
      for (const f of fs) expect(applyField(l, ref, f.key, f.value)).toEqual(l);
    }
  });
  it('Station-Nummer tauscht', () => {
    const l = addElement(newLevel(), 'station', { x: 1500, y: 500 }).level;
    const r = applyField(l, { kind: 'station', index: 0 }, 'number', 2);
    expect(r.stations[1]).toEqual(l.stations[0]);
  });
});

describe('levelFields', () => {
  it('ID nur [a-z0-9-]', () => {
    const l = newLevel();
    expect(applyLevelField(l, 'id', 'Mein Level!')).toBe(l);
    expect(applyLevelField(l, 'id', 'mein-level-2').id).toBe('mein-level-2');
  });
  it('Tinte je Abschnitt, auch unbegrenzt', () => {
    const l = newLevel();
    expect(applyLevelField(l, 'ink.0', 500).areas[0].ink).toBe(500);
    expect(applyLevelField(l, 'inkUnlimited.0', true).areas[0].ink).toBe('unlimited');
    expect(levelFields(l).some((f) => f.key === 'boost.0')).toBe(true);
  });
  it('Name, Weltgröße, Polarlicht', () => {
    let l = applyLevelField(newLevel(), 'name', 'Hallo');
    l = applyLevelField(l, 'worldW', 3000);
    l = applyLevelField(l, 'auroraHue', 200);
    expect([l.name, l.worldW, l.theme.auroraHue]).toEqual(['Hallo', 3000, 200]);
  });
});
