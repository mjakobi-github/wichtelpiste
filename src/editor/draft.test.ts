import { describe, expect, it } from 'vitest';
import { Draft } from './draft';
import { newLevel } from './template';

function mem() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

describe('Draft', () => {
  it('speichern, laden, löschen', () => {
    const s = mem();
    const d = new Draft(s);
    const data = { level: newLevel(), solution: null, file: '09-x.json', camera: { cx: 1, cy: 2, zoom: 0.5 } };
    d.save(data);
    expect(s.m.has('wichtelpiste.editor.draft.v1')).toBe(true);
    expect(d.load()).toEqual(data);
    d.clear();
    expect(d.load()).toBeNull();
  });
  it('ungültiger Zwischenstand (kein Geschenk) bleibt erhalten', () => {
    const s = mem();
    const d = new Draft(s);
    const level = { ...newLevel(), gifts: [] };
    d.save({ level, solution: null, file: null, camera: null });
    expect(d.load()?.level.gifts).toEqual([]);
  });

  it('kaputte Daten → null', () => {
    const s = mem();
    s.setItem('wichtelpiste.editor.draft.v1', '{kaputt');
    expect(new Draft(s).load()).toBeNull();
    s.setItem('wichtelpiste.editor.draft.v1', '{"level":{"version":3}}');
    expect(new Draft(s).load()).toBeNull();
  });
  it('Speicher wirft → still', () => {
    const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
    const d = new Draft(bad);
    expect(d.load()).toBeNull();
    expect(() => d.save({ level: newLevel(), solution: null, file: null, camera: null })).not.toThrow();
    expect(() => d.clear()).not.toThrow();
    expect(new Draft(null).load()).toBeNull();
  });
});
