import { describe, expect, it } from 'vitest';
import { Prefs } from './prefs';

function mem() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

describe('Prefs', () => {
  it('Standardwerte', () => {
    expect(new Prefs(mem()).get()).toEqual({ mode: 'simple', view: 'pretty', showJumps: true, senderName: '' });
  });
  it('kaputtes JSON → Standard', () => {
    const s = mem();
    s.setItem('wichtelpiste.editor.prefs.v1', '{x');
    expect(new Prefs(s).get().mode).toBe('simple');
  });
  it('set speichert und merkt', () => {
    const s = mem();
    new Prefs(s).set({ mode: 'pro', view: 'sketch' });
    expect(new Prefs(s).get()).toMatchObject({ mode: 'pro', view: 'sketch' });
  });
  it('Name getrimmt, höchstens 20 Zeichen', () => {
    const p = new Prefs(mem());
    expect(p.set({ senderName: '  Lena-Marie-Sophie-Charlotte  ' }).senderName).toBe('Lena-Marie-Sophie-Ch');
  });
  it('schwaches Gerät startet in Skizze, gespeicherte Wahl gewinnt', () => {
    expect(new Prefs(mem(), true).get().view).toBe('sketch');
    const s = mem();
    new Prefs(s).set({ view: 'pretty' });
    expect(new Prefs(s, true).get().view).toBe('pretty');
  });
  it('ungültige Werte werden ignoriert, Speicher wirft → still', () => {
    const s = mem();
    s.setItem('wichtelpiste.editor.prefs.v1', JSON.stringify({ mode: 'hacker', view: 3, showJumps: 'ja' }));
    expect(new Prefs(s).get()).toEqual({ mode: 'simple', view: 'pretty', showJumps: true, senderName: '' });
    const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    expect(() => new Prefs(bad).set({ mode: 'pro' })).not.toThrow();
  });
});
