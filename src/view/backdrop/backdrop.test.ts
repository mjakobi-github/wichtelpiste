import { describe, expect, it } from 'vitest';
import { mountainProfile, parallaxOffset } from './index';

describe('parallaxOffset', () => {
  it('verschiebt um camX · Faktor, gekachelt auf die Periode', () => {
    expect(parallaxOffset(1000, 0.5, 800)).toBe(500);
    expect(parallaxOffset(2000, 0.5, 800)).toBe(200);
  });
  it('liefert für negative camX einen Wert in [0, period)', () => {
    for (const x of [-1, -799, -800, -12345]) {
      const o = parallaxOffset(x, 0.18, 800);
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThan(800);
    }
  });
});

describe('mountainProfile', () => {
  it('gleicher Seed → gleiche Höhenliste, anderer Seed → andere', () => {
    expect(mountainProfile(3, 1600)).toEqual(mountainProfile(3, 1600));
    expect(mountainProfile(3, 1600)).not.toEqual(mountainProfile(4, 1600));
  });
  it('ist nahtlos kachelbar (erster = letzter Wert)', () => {
    const p = mountainProfile(7, 1600);
    expect(p[0]).toBeCloseTo(p[p.length - 1], 6);
  });
});
