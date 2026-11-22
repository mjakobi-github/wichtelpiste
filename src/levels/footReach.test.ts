import { describe, expect, it } from 'vitest';
import { LEVELS } from './index';
import { runArea, type Solution } from './solveRunner';
import { footReach, type Ride } from './footReach';
import { newLevel } from '../editor/template';
import type { LevelData } from '../sim/types';

const files = import.meta.glob<Solution>('./solutions/*.json', { eager: true, import: 'default' });

function ridesFor(l: LevelData, sol: Solution): Ride[] {
  return l.areas.map((_, i) => {
    const r = runArea(l, sol, i);
    const o = r.outcome;
    return { arrive: o?.type === 'arrive' ? o.pos : null, win: o?.type === 'win', gifts: r.gifts };
  });
}

/** Vorlage mit passender Fahrt (Landezone 1300–1540 auf dem rechten Dach). */
const templateRide = (l: LevelData): Ride[] => [{ arrive: { x: 1350, y: 560 }, win: false, gifts: [] }].slice(0, l.stations.length);

describe('footReach', () => {
  for (const l of LEVELS) {
    it(`${l.id}: alle Stationen, alle Geschenke, Schornstein`, () => {
      const f = footReach(l, ridesFor(l, files[`./solutions/${l.id}.json`]));
      expect(f.stations.every(Boolean)).toBe(true);
      expect(f.gifts.every(Boolean)).toBe(true);
      expect(f.winnable).toBe(true);
      expect(f.truncated).toBe(false);
    });
  }

  it('Vorlage ist gewinnbar', () => {
    const l = newLevel();
    expect(footReach(l, templateRide(l)).winnable).toBe(true);
  });

  it('ohne Fahrt bleibt das rechte Dach unerreichbar', () => {
    const l = newLevel();
    const f = footReach(l, [null]);
    expect(f.stations[0]).toBe(true);
    expect(f.chimney).toBe(false);
    expect(f.winnable).toBe(false);
  });

  it('Geschenk hoch in der Luft: nicht erreichbar', () => {
    const l = newLevel();
    l.gifts.push({ x: 400, y: 200 });
    const f = footReach(l, templateRide(l));
    expect(f.gifts).toEqual([true, false]);
    expect(f.winnable).toBe(true);
  });

  it('Station auf einem zu hohen Dach: nicht erreichbar', () => {
    const l = newLevel();
    l.platforms.push({ x: 600, y: 300, w: 200, h: 24 });
    l.stations[0] = { pos: { x: 700, y: 240 } };
    const f = footReach(l, templateRide(l));
    expect(f.stations[0]).toBe(false);
    expect(f.winnable).toBe(false);
  });

  it('Sprungfeder macht das hohe Dach erreichbar', () => {
    const l = newLevel();
    l.platforms.push({ x: 600, y: 300, w: 200, h: 24 });
    l.stations[0] = { pos: { x: 700, y: 240 } };
    l.springs.push({ pos: { x: 500, y: 620 }, angle: 0, power: 1400 });
    expect(footReach(l, templateRide(l)).stations[0]).toBe(true);
  });
});
