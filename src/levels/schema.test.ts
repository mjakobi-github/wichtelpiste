import { describe, expect, it } from 'vitest';
import { LevelError, validateLevel } from './schema';
import { LEVELS } from './index';
import { minimalLevel } from './testFixtures';

describe('validateLevel', () => {
  it('setzt Defaults für optionale Felder', () => {
    const lv = validateLevel(minimalLevel(), 'min.json');
    expect(lv.hazards).toEqual([]);
    expect(lv.movers).toEqual([]);
    expect(lv.springs).toEqual([]);
    expect(lv.noDraw).toEqual([]);
    expect(lv.hints).toEqual([]);
    expect(lv.checkpoints).toEqual([]);
    expect(lv.theme).toEqual({ seed: 1, auroraHue: 150 });
  });

  it('areas kürzer als stations wirft mit Pfad', () => {
    const raw = minimalLevel();
    raw.areas = [];
    expect(() => validateLevel(raw, 'x.json')).toThrow(LevelError);
    expect(() => validateLevel(raw, 'x.json')).toThrow(/areas/);
  });

  it('Plattform mit Eis: ice wird übernommen, sonst false', () => {
    const raw = minimalLevel();
    const plats = raw.platforms as object[];
    raw.platforms = [{ ...plats[0], ice: true }, ...plats];
    const lv = validateLevel(raw, 'x.json');
    expect(lv.platforms[0].ice).toBe(true);
    expect(lv.platforms[1].ice).toBe(false);
    expect(() => validateLevel({ ...raw, platforms: [{ ...plats[0], ice: 'ja' }] }, 'x.json')).toThrow(/platforms\[0\]\.ice/);
  });

  it('mehr Landezonen als Abschnitte wirft', () => {
    const raw = { ...minimalLevel(), dismounts: [{ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 10 }] };
    expect(() => validateLevel(raw, 'x.json')).toThrow(/dismounts/);
  });

  it('falsche Version wirft', () => {
    expect(() => validateLevel({ ...minimalLevel(), version: 2 }, 'x.json')).toThrow(LevelError);
  });

  it('ungültiges Budget wirft mit Pfad', () => {
    const raw = minimalLevel();
    raw.areas = [{ ink: -5, boost: 0 }];
    expect(() => validateLevel(raw, 'x.json')).toThrow(/areas\[0\]\.ink/);
  });

  it('ohne Geschenke wirft', () => {
    expect(() => validateLevel({ ...minimalLevel(), gifts: [] }, 'x.json')).toThrow(/gifts/);
  });

  it('Feder ohne Kraft wirft', () => {
    const raw = { ...minimalLevel(), springs: [{ pos: { x: 0, y: 0 }, angle: 0, power: 0 }] };
    expect(() => validateLevel(raw, 'x.json')).toThrow(/springs\[0\]\.power/);
  });
});

describe('LEVELS', () => {
  it('enthält mindestens ein gültiges Level', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(1);
    for (const lv of LEVELS) expect(lv.version).toBe(1);
  });
});
