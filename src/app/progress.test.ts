import { describe, expect, it } from 'vitest';
import { Progress } from './progress';
import { validateLevel } from '../levels/schema';
import { minimalLevel } from '../levels/testFixtures';

function memStorage(init: Record<string, string> = {}) {
  const data = { ...init };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => { data[k] = v; },
  };
}
const lv = () => validateLevel(minimalLevel(), 't.json');
const win = (stars: 1 | 2 | 3, inkUsed: number) => ({ stars, gifts: 1, giftTotal: 1, inkUsed });

describe('Progress', () => {
  it('Bestwert nur bei 3 Sternen, kleiner ist besser', () => {
    const p = new Progress(memStorage());
    expect(p.record(lv(), win(2, 300)).newBestInk).toBe(false);
    expect(p.get(lv()).bestInk).toBeNull();
    expect(p.record(lv(), win(3, 500))).toEqual({ newBestInk: true, improvedStars: true });
    expect(p.record(lv(), win(3, 450)).newBestInk).toBe(true);
    expect(p.record(lv(), win(3, 480)).newBestInk).toBe(false);
    expect(p.get(lv())).toEqual({ stars: 3, bestInk: 450 });
  });

  it('Sterne sinken nie', () => {
    const p = new Progress(memStorage());
    p.record(lv(), win(3, 100));
    expect(p.record(lv(), win(1, 50)).improvedStars).toBe(false);
    expect(p.get(lv()).stars).toBe(3);
  });

  it('übersteht Neuladen', () => {
    const st = memStorage();
    new Progress(st).record(lv(), win(3, 222));
    expect(new Progress(st).get(lv())).toEqual({ stars: 3, bestInk: 222 });
  });

  it('geändertes Level beginnt neu', () => {
    const st = memStorage();
    new Progress(st).record(lv(), win(3, 222));
    const changed = lv();
    changed.gifts[0].x += 10;
    expect(new Progress(st).get(changed)).toEqual({ stars: 0, bestInk: null });
  });

  it('ohne Speicher kein Fehler', () => {
    const p = new Progress(null);
    expect(p.get(lv())).toEqual({ stars: 0, bestInk: null });
    expect(() => p.record(lv(), win(3, 1))).not.toThrow();
  });

  it('kaputtes JSON und werfendes setItem werden geschluckt', () => {
    const st = memStorage({ 'schlittenfahrer.progress.v1': '{kaputt' });
    st.setItem = () => { throw new Error('voll'); };
    const p = new Progress(st);
    expect(p.get(lv())).toEqual({ stars: 0, bestInk: null });
    expect(() => p.record(lv(), win(3, 1))).not.toThrow();
  });
});
