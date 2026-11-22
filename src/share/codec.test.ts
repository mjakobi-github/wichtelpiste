import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeShare, encodeShare, readShareHash, ShareError, SHARE_MAX_CODE, shareUrl } from './codec';
import { LEVELS } from '../levels';
import { checkSolution } from '../levels/solutionCheck';
import { validateLevel } from '../levels/schema';
import { springBackLevel } from '../levels/testFixtures';
import type { Solution } from '../levels/solveRunner';

const sols = import.meta.glob<Solution>('../levels/solutions/*.json', { eager: true, import: 'default' });

describe('Teilen-Codec', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('alle Menü-Levels: hin und zurück bleibt lösbar und unter der Grenze', async () => {
    for (const l of LEVELS) {
      const code = await encodeShare({ level: l, from: 'Oma', challengeInk: 412 });
      expect(code.length, l.id).toBeLessThan(SHARE_MAX_CODE);
      expect(code[0]).toBe('1');
      const back = await decodeShare(code);
      expect(back.from).toBe('Oma');
      expect(back.challengeInk).toBe(412);
      expect(back.level.name).toBe(l.name);
      expect(back.level.platforms).toEqual(l.platforms);
      expect(checkSolution(back.level, sols[`../levels/solutions/${l.id}.json`]).ok, l.id).toBe(true);
    }
  });

  it('Fahrtrichtung der Station bleibt erhalten', async () => {
    const l = { ...LEVELS[0], stations: [{ ...LEVELS[0].stations[0], dir: -1 as const }] };
    const back = await decodeShare(await encodeShare({ level: l, from: '', challengeInk: null }));
    expect(back.level.stations[0].dir).toBe(-1);
    expect(LEVELS[0].stations[0].dir).toBeUndefined();
  });

  it('ohne Rekord', async () => {
    const back = await decodeShare(await encodeShare({ level: LEVELS[1], from: '', challengeInk: null }));
    expect(back.challengeInk).toBeNull();
    expect(back.from).toBe('');
  });

  it('zu neue Version und kaputte Codes → ShareError', async () => {
    const code = await encodeShare({ level: LEVELS[0], from: 'x', challengeInk: null });
    await expect(decodeShare('9' + code.slice(1))).rejects.toThrow(/neuere Version/);
    await expect(decodeShare(code.slice(0, 40))).rejects.toBeInstanceOf(ShareError);
    await expect(decodeShare('')).rejects.toBeInstanceOf(ShareError);
    await expect(decodeShare('1%%%')).rejects.toBeInstanceOf(ShareError);
  });

  it('Ziel links ohne Richtung: neue Links fahren zum Ziel, alte Links (ohne Markierung) wie früher nach rechts', async () => {
    vi.stubGlobal('CompressionStream', undefined);
    const level = validateLevel(springBackLevel(), 'x');
    const code = await encodeShare({ level, from: '', challengeInk: null });
    expect((await decodeShare(code)).level.stations[0].dir).toBeUndefined();
    // Alter Link: gleiche Daten ohne das Feld D
    const obj = JSON.parse(atob(code.slice(1).replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
    expect(obj.D).toBe(1);
    delete obj.D;
    const old = '0' + btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect((await decodeShare(old)).level.stations[0].dir).toBe(1);
  });

  it('ohne CompressionStream: unkomprimiert, Rückweg geht', async () => {
    vi.stubGlobal('CompressionStream', undefined);
    const code = await encodeShare({ level: LEVELS[2], from: 'A', challengeInk: null });
    expect(code[0]).toBe('0');
    vi.unstubAllGlobals();
    expect((await decodeShare(code)).level.name).toBe(LEVELS[2].name);
  });

  it('Link und Hash', () => {
    expect(shareUrl('abc', 'https://x.github.io/wichtelpiste/')).toBe('https://x.github.io/wichtelpiste/#l=abc');
    expect(readShareHash('#l=abc')).toBe('abc');
    expect(readShareHash('#foo')).toBeNull();
    expect(readShareHash('')).toBeNull();
  });
});
