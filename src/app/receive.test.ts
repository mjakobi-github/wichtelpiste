import { describe, expect, it } from 'vitest';
import { receiveFromHash } from './receive';
import { Gifts } from './library';
import { encodeShare } from '../share/codec';
import { LEVELS } from '../levels';

function mem() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

describe('receiveFromHash', () => {
  it('gültiger Link → Geschenk gespeichert', async () => {
    const gifts = new Gifts(mem());
    const code = await encodeShare({ level: LEVELS[3], from: 'Lena', challengeInk: 412 });
    const r = await receiveFromHash(`#l=${code}`, gifts);
    expect(r.kind).toBe('gift');
    if (r.kind === 'gift') expect(r.gift).toMatchObject({ from: 'Lena', challengeInk: 412 });
    expect(gifts.list().length).toBe(1);
  });

  it('gleicher Link zweimal → ein Eintrag', async () => {
    const gifts = new Gifts(mem());
    const code = await encodeShare({ level: LEVELS[3], from: 'Lena', challengeInk: null });
    await receiveFromHash(`#l=${code}`, gifts);
    await receiveFromHash(`#l=${code}`, gifts);
    expect(gifts.list().length).toBe(1);
  });

  it('kaputter Link → Fehler, nichts gespeichert', async () => {
    const gifts = new Gifts(mem());
    const r = await receiveFromHash('#l=1abc', gifts);
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.message).toMatch(/kaputt/);
    expect(gifts.list()).toEqual([]);
  });

  it('kein Link → none', async () => {
    expect((await receiveFromHash('', new Gifts(mem()))).kind).toBe('none');
    expect((await receiveFromHash('#xyz', new Gifts(mem()))).kind).toBe('none');
  });
});
