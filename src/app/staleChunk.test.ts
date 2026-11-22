import { describe, expect, it } from 'vitest';
import { claimReload, mayReload, RELOAD_COOLDOWN_MS } from './staleChunk';

function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => { m.delete(k); },
    setItem: (k, v) => { m.set(k, v); },
  };
}

describe('mayReload', () => {
  it('erlaubt das erste Neuladen', () => expect(mayReload(null, 1000)).toBe(true));
  it('sperrt kurz danach', () => expect(mayReload(1000, 1000 + RELOAD_COOLDOWN_MS - 1)).toBe(false));
  it('erlaubt nach der Sperrzeit', () => expect(mayReload(1000, 1000 + RELOAD_COOLDOWN_MS)).toBe(true));
  it('verstellte Uhr (Zeitpunkt in der Zukunft) blockiert nicht dauerhaft', () => expect(mayReload(5000, 1000)).toBe(true));
});

describe('claimReload', () => {
  it('nur einmal innerhalb der Sperrzeit', () => {
    const s = memStorage();
    expect(claimReload(s, 1000)).toBe(true);
    expect(claimReload(s, 2000)).toBe(false);
    expect(claimReload(s, 1000 + RELOAD_COOLDOWN_MS)).toBe(true);
  });
  it('ohne Speicher kein Neuladen (Schleifengefahr)', () => expect(claimReload(null, 1000)).toBe(false));
  it('kaputter Wert zählt als „noch nie“', () => {
    const s = memStorage();
    s.setItem('wichtelpiste.chunkReloadAt', 'quatsch');
    expect(claimReload(s, 1000)).toBe(true);
  });
});
