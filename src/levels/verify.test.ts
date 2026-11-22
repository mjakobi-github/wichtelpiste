import { describe, expect, it } from 'vitest';
import { LEVELS } from './index';
import { playableWithBudgets, verifyLevel } from './verify';
import { checkSolution } from './solutionCheck';
import { newLevel } from '../editor/template';
import { validateLevel } from './schema';

describe('verifyLevel', () => {
  it('Vorlage: spielbar, Lösung gefunden und gültig', async () => {
    const l = newLevel();
    const v = await verifyLevel(l, null);
    expect(v.problems).toEqual([]);
    expect(v.playable).toBe(true);
    expect(v.allGifts).toBe(true);
    expect(v.areas[0].auto).toBe(true);
    expect(checkSolution(l, v.solution).ok).toBe(true);
  });

  it('Menü-Level ohne Lösung: spielbar', async () => {
    const v = await verifyLevel(LEVELS[2], null);
    expect(v.problems).toEqual([]);
    expect(v.playable).toBe(true);
  });

  it('zu wenig Tinte: Problem mit Zahlen und Tinten-Vorschlag', async () => {
    const l = newLevel();
    l.areas[0] = { ink: 100, boost: 0 };
    const v = await verifyLevel(l, null);
    expect(v.playable).toBe(false);
    expect(v.problems[0]).toMatch(/Tinte reicht nicht/);
    expect(playableWithBudgets(v)).toBe(true);
    const ink = v.budgets![0].ink as number;
    expect(ink).toBeGreaterThan(100);
    const raised = { ...l, areas: v.budgets! };
    expect(checkSolution(raised, v.solution).ok).toBe(true);
  });

  it('Schornstein in der Luft: nicht spielbar, mit Koordinaten', async () => {
    const l = newLevel();
    l.platforms.push({ x: 2100, y: 200, w: 200, h: 24 });
    l.chimney = { x: 2200, y: 200 };
    const v = await verifyLevel(l, null);
    expect(v.playable).toBe(false);
    expect(v.problems.join(' ')).toContain('Schornstein (2200, 200)');
  });

  it('unerreichbares Geschenk: spielbar, aber Warnung', async () => {
    const l = newLevel();
    l.gifts.push({ x: 1800, y: 150 });
    const v = await verifyLevel(l, null);
    expect(v.playable).toBe(true);
    expect(v.allGifts).toBe(false);
    expect(v.warnings[0]).toMatch(/Geschenk 2 \(1800, 150\)/);
  });

  it('reines Jump\'n\'Run ohne Station: spielbar über Sprünge', async () => {
    const l = validateLevel({
      version: 1, id: 'jnr', name: 'Nur laufen', worldW: 1600, worldH: 800,
      spawn: { x: 60, y: 540 },
      platforms: [{ x: 0, y: 600, w: 500, h: 200 }, { x: 620, y: 520, w: 400, h: 280 }, { x: 1100, y: 600, w: 500, h: 200 }],
      stations: [], areas: [],
      gifts: [{ x: 800, y: 495 }], chimney: { x: 1400, y: 600 },
    }, 'jnr.json');
    const v = await verifyLevel(l, null);
    expect(v.problems).toEqual([]);
    expect(v.playable).toBe(true);
    expect(v.allGifts).toBe(true);
  });
});
