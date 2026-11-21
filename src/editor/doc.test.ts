import { describe, expect, it } from 'vitest';
import { validateLevel } from '../levels/schema';
import { LEVELS } from '../levels';
import {
  addElement, duplicateElement, getElement, listElements, moveElement, removeElement, renumberStation, setElement, snap,
  type ElementKind,
} from './doc';
import { newLevel } from './template';
import type { LevelData } from '../sim/types';

const ok = (l: LevelData): LevelData => validateLevel(JSON.parse(JSON.stringify(l)), 'test');

/** Level mit zwei Stationen und zwei Landezonen. */
function twoStations(): LevelData {
  const l = newLevel();
  const a = addElement(l, 'station', { x: 1500, y: 500 }).level;
  return { ...a, dismounts: [...a.dismounts, { x: 2000, y: 500, w: 200, h: 100 }] };
}

const VARIANTS: [ElementKind, string?][] = [
  ['platform'], ['platform', 'ice'], ['station'], ['dismount'], ['gift'], ['checkpoint'], ['icicle'], ['candy'],
  ['hazard', 'icicle-hanging'], ['hazard', 'tinsel'], ['mover', 'bell'], ['mover', 'crow'], ['spring'], ['noDraw'], ['hint'],
];

describe('newLevel', () => {
  it('ist gültig', () => expect(() => ok(newLevel())).not.toThrow());
});

describe('addElement', () => {
  it.each(VARIANTS)('%s %s: gültig, Ref zeigt auf das neue Element', (kind, variant) => {
    const base = kind === 'dismount' ? addElement(newLevel(), 'station', { x: 900, y: 400 }).level : newLevel();
    const { level, ref } = addElement(base, kind, { x: 400, y: 300 }, variant);
    expect(() => ok(level)).not.toThrow();
    expect(ref.kind).toBe(kind);
    expect(listElements(level).length).toBe(listElements(base).length + 1);
    expect(getElement(level, ref)).toBeDefined();
  });

  it('Eis-Variante setzt ice', () => {
    const { level, ref } = addElement(newLevel(), 'platform', { x: 0, y: 0 }, 'ice');
    expect((getElement(level, ref) as { ice: boolean }).ice).toBe(true);
  });

  it('Station bringt einen Abschnitt mit', () => {
    const l = addElement(newLevel(), 'station', { x: 900, y: 400 }).level;
    expect(l.areas.length).toBe(l.stations.length);
  });

  it('Startpunkt und Schornstein werden versetzt, nicht verdoppelt', () => {
    const r = addElement(newLevel(), 'chimney', { x: 777, y: 500 });
    expect(r.level.chimney).toEqual({ x: 777, y: 500 });
    expect(r.ref).toEqual({ kind: 'chimney', index: 0 });
  });

  it('verändert die Eingabe nicht', () => {
    const l = newLevel();
    const before = structuredClone(l);
    addElement(l, 'gift', { x: 1, y: 2 });
    expect(l).toEqual(before);
  });
});

describe('removeElement', () => {
  it('Station 0 entfernt auch Abschnitt und Landezone, Rest rückt nach', () => {
    const l = twoStations();
    const second = l.stations[1];
    const r = removeElement(l, { kind: 'station', index: 0 });
    expect(r.stations).toEqual([second]);
    expect(r.areas.length).toBe(1);
    expect(r.dismounts).toEqual([l.dismounts[1]]);
    expect(() => ok(r)).not.toThrow();
  });

  it('Startpunkt und Schornstein bleiben', () => {
    const l = newLevel();
    expect(removeElement(l, { kind: 'spawn', index: 0 })).toBe(l);
    expect(removeElement(l, { kind: 'chimney', index: 0 })).toBe(l);
  });

  it('Geschenk entfernen', () => {
    const l = addElement(newLevel(), 'gift', { x: 5, y: 5 }).level;
    expect(removeElement(l, { kind: 'gift', index: 1 }).gifts.length).toBe(1);
  });
});

describe('renumberStation', () => {
  it('tauscht Station, Abschnitt und Landezone', () => {
    const l = twoStations();
    l.areas[1] = { ink: 123, boost: 0 };
    const r = renumberStation(l, 0, 1);
    expect(r.stations).toEqual([l.stations[1], l.stations[0]]);
    expect(r.areas).toEqual([l.areas[1], l.areas[0]]);
    expect(r.dismounts).toEqual([l.dismounts[1], l.dismounts[0]]);
  });
});

describe('moveElement', () => {
  it('Pendel: Drehpunkt wandert', () => {
    const { level, ref } = addElement(newLevel(), 'mover', { x: 400, y: 200 }, 'bell');
    const m = moveElement(level, ref, 10, 20).movers[0].path;
    const before = level.movers[0].path;
    if (m.type !== 'pendulum' || before.type !== 'pendulum') throw new Error('Pendel erwartet');
    expect(m.pivot).toEqual({ x: before.pivot.x + 10, y: before.pivot.y + 20 });
  });

  it('Linie: Start und Ende wandern', () => {
    const { level, ref } = addElement(newLevel(), 'mover', { x: 400, y: 200 }, 'crow');
    const p = moveElement(level, ref, 5, 0).movers[0].path;
    const b = level.movers[0].path;
    if (p.type !== 'line' || b.type !== 'line') throw new Error('Linie erwartet');
    expect(p.from.x).toBe(b.from.x + 5);
    expect(p.to.x).toBe(b.to.x + 5);
  });

  it('Rechteck, Station, Feder, Gefahr, Hinweis', () => {
    const l = LEVELS.find((x) => x.springs.length && x.hazards.length)!;
    expect(moveElement(l, { kind: 'platform', index: 0 }, 3, 4).platforms[0].x).toBe(l.platforms[0].x + 3);
    expect(moveElement(l, { kind: 'station', index: 0 }, 3, 4).stations[0].pos.y).toBe(l.stations[0].pos.y + 4);
    expect(moveElement(l, { kind: 'spring', index: 0 }, 3, 4).springs[0].pos.x).toBe(l.springs[0].pos.x + 3);
    expect(moveElement(l, { kind: 'hazard', index: 0 }, 3, 4).hazards[0].rect.x).toBe(l.hazards[0].rect.x + 3);
    const h = addElement(l, 'hint', { x: 500, y: 500 });
    expect(moveElement(h.level, h.ref, 3, 4).hints.at(-1)!.at.x).toBe(h.level.hints.at(-1)!.at.x + 3);
  });
});

describe('duplicate, get/set, snap', () => {
  it('dupliziert versetzt', () => {
    const l = newLevel();
    const r = duplicateElement(l, { kind: 'platform', index: 0 });
    const n = l.platforms.length;
    expect(r.level.platforms.length).toBe(n + 1);
    expect(r.level.platforms[n].x).toBe(l.platforms[0].x + 40);
    expect(r.ref).toEqual({ kind: 'platform', index: n });
  });

  it('Station duplizieren bringt Abschnitt mit', () => {
    const r = duplicateElement(newLevel(), { kind: 'station', index: 0 });
    expect(r.level.areas.length).toBe(2);
    expect(() => ok(r.level)).not.toThrow();
  });

  it('setElement ersetzt genau ein Element', () => {
    const l = newLevel();
    const r = setElement(l, { kind: 'gift', index: 0 }, { x: 1, y: 2 });
    expect(r.gifts[0]).toEqual({ x: 1, y: 2 });
    expect(l.gifts[0]).not.toEqual({ x: 1, y: 2 });
    expect(setElement(l, { kind: 'spawn', index: 0 }, { x: 9, y: 9 }).spawn).toEqual({ x: 9, y: 9 });
  });

  it('snap', () => {
    expect(snap(13, true)).toBe(10);
    expect(snap(16, true)).toBe(20);
    expect(snap(13, false)).toBe(13);
  });
});
