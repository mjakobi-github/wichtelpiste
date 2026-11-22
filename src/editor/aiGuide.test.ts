import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateLevel } from '../levels/schema';
import { verifyLevel } from '../levels/verify';
import { newLevel } from './template';
import { jumpStats } from './jumpReach';
import { aiInstructions } from './ai';

/** Die Bauanleitung für Chatbots (public/ki-bauanleitung.md) muss zum Spiel passen. */
const guide = readFileSync(resolve(__dirname, '../../public/ki-bauanleitung.md'), 'utf8');
const examples = [...guide.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => m[1]);
const KEYS = Object.keys(newLevel());

describe('KI-Bauanleitung', () => {
  it('nennt jedes Level-Feld', () => {
    for (const k of KEYS) expect(guide, k).toContain(`"${k}"`);
  });

  it('kurze Anleitung nennt jedes Level-Feld', () => {
    const text = aiInstructions('');
    for (const k of KEYS) expect(text, k).toContain(`"${k}"`);
  });

  it('Sprungwerte stimmen mit der Spielphysik', () => {
    const j = jumpStats(false);
    expect(guide).toContain(`bis **${Math.floor(j.height / 10) * 10} px hoch**`);
    expect(guide).toContain(`**${Math.round(j.distanceSameLevel)} px weit**`);
  });

  it('hat Beispiele für Jump\'n\'Run, Schlittenfahrt und gemischt', () => {
    const lv = examples.map((e) => validateLevel(JSON.parse(e), 'Beispiel'));
    expect(lv.map((l) => l.stations.length)).toEqual([0, 1, 2]);
    expect(lv[1].dismounts).toEqual([]);
  });

  it.each(examples.map((e, i) => [i, e] as const))('Beispiel %i ist spielbar mit allen Geschenken', async (_, e) => {
    const l = validateLevel(JSON.parse(e), 'Beispiel');
    // Level aus dem Spiel: mit ihrer gespeicherten Lösung prüfen (wie im Editor)
    const solFile = resolve(__dirname, `../levels/solutions/${l.id}.json`);
    const sol = existsSync(solFile) ? JSON.parse(readFileSync(solFile, 'utf8')) : null;
    const v = await verifyLevel(l, sol);
    expect(v.problems).toEqual([]);
    expect(v.warnings).toEqual([]);
    expect(v.playable).toBe(true);
    expect(v.allGifts).toBe(true);
  }, 60_000);
});
