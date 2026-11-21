import { describe, expect, it } from 'vitest';
import { computeStars, levelHash } from './scoring';
import { validateLevel } from '../levels/schema';
import { minimalLevel } from '../levels/testFixtures';

describe('computeStars', () => {
  it('Schwellen', () => {
    expect(computeStars(0, 10)).toBe(0);
    expect(computeStars(1, 10)).toBe(1);
    expect(computeStars(5, 10)).toBe(1);
    expect(computeStars(6, 10)).toBe(2);
    expect(computeStars(10, 10)).toBe(3);
  });
});

describe('levelHash', () => {
  const base = () => validateLevel(minimalLevel(), 't.json');
  it('stabil und 8-stellig hex', () => {
    expect(levelHash(base())).toBe(levelHash(base()));
    expect(levelHash(base())).toMatch(/^[0-9a-f]{8}$/);
  });
  it('ändert sich bei verschobenem Geschenk', () => {
    const b = base();
    b.gifts[0].x += 1;
    expect(levelHash(b)).not.toBe(levelHash(base()));
  });
  it('ignoriert Hinweise', () => {
    const b = base();
    b.hints.push({ at: { x: 0, y: 0, w: 1, h: 1 }, text: 'Hallo', icon: 'move' });
    expect(levelHash(b)).toBe(levelHash(base()));
  });
});
