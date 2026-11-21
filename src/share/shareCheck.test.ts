import { describe, expect, it } from 'vitest';
import { shareableCheck } from './shareCheck';
import { LEVELS } from '../levels';
import type { Solution } from '../levels/solveRunner';

const sols = import.meta.glob<Solution>('../levels/solutions/*.json', { eager: true, import: 'default' });
const sol = sols[`../levels/solutions/${LEVELS[0].id}.json`];

describe('shareableCheck', () => {
  it('prüft das Level so, wie es beim Empfänger ankommt (gerundet)', async () => {
    const l = { ...LEVELS[0], platforms: LEVELS[0].platforms.map((p) => ({ ...p, x: p.x + 0.3 })) };
    const r = await shareableCheck(l, sol, { from: 'A', challengeInk: null });
    expect(r.ok).toBe(true);
    expect(Number.isInteger(r.payload.level.platforms[0].x)).toBe(true);
    expect(r.code.length).toBeGreaterThan(10);
  });
  it('ohne Lösung → nicht teilbar', async () => {
    const r = await shareableCheck(LEVELS[0], null, { from: 'A', challengeInk: null });
    expect(r.ok).toBe(false);
  });
});
