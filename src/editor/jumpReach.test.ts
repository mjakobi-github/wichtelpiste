import { describe, expect, it } from 'vitest';
import { jumpArc, jumpStats, reachFrom } from './jumpReach';
import { newLevel } from './template';

describe('Sprungbögen', () => {
  it('Höhe und Weite im erwarteten Bereich', () => {
    const s = jumpStats(false);
    expect(s.height).toBeGreaterThan(170);
    expect(s.height).toBeLessThan(240);
    expect(s.distanceSameLevel).toBeGreaterThan(150);
  });

  it('Eis springt mindestens so weit', () => {
    expect(jumpStats(true).distanceSameLevel).toBeGreaterThanOrEqual(jumpStats(false).distanceSameLevel - 1);
  });

  it('links ist das Spiegelbild von rechts', () => {
    const r = jumpArc({ ice: false, dir: 1 });
    const l = jumpArc({ ice: false, dir: -1 });
    expect(l.length).toBe(r.length);
    l.forEach((p, i) => {
      expect(p.x).toBeCloseTo(-r[i].x, 5);
      expect(p.y).toBeCloseTo(r[i].y, 5);
    });
  });

  it('Bogen beginnt an der Kante und fällt am Ende tief', () => {
    const a = jumpArc({ ice: false, dir: 1 });
    expect(Math.abs(a[0].x)).toBeLessThan(30);
    expect(Math.abs(a[0].y)).toBeLessThan(5);
    expect(a.at(-1)!.y).toBeGreaterThan(500);
  });

  it('reachFrom: Plattform hat zwei Bögen an den oberen Ecken, Geschenk keinen', () => {
    const l = newLevel();
    const p = l.platforms[0];
    const r = reachFrom(l, { kind: 'platform', index: 0 });
    expect(r.map((x) => x.origin)).toEqual([{ x: p.x, y: p.y }, { x: p.x + p.w, y: p.y }]);
    expect(r[0].arc[5].x).toBeLessThan(p.x);
    expect(r[1].arc[5].x).toBeGreaterThan(p.x + p.w);
    expect(reachFrom(l, { kind: 'gift', index: 0 })).toEqual([]);
    expect(reachFrom(l, { kind: 'spawn', index: 0 }).length).toBe(2);
    expect(reachFrom(l, { kind: 'dismount', index: 0 }).length).toBe(2);
  });
});
