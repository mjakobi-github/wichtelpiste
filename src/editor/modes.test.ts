import { describe, expect, it } from 'vitest';
import { autoInkAllowed, fieldsForMode, friendlyIssue, paletteFor } from './modes';
import { PALETTE } from './panels';
import { fieldsFor } from './fields';
import { levelIssues } from './checks';
import { newLevel } from './template';

describe('Einfach/Profi', () => {
  it('Einfach: nur einfache Bausteine', () => {
    const kinds = paletteFor('simple').map((p) => p.label);
    expect(kinds).toEqual(['Boden', 'Eis', 'Start', 'Station', 'Landezone', 'Geschenk', 'Laterne', 'Schornstein', 'Eiszapfen', 'Zuckerstange', 'Feder']);
    expect(paletteFor('simple').some((p) => p.kind === 'mover' || p.kind === 'hazard' || p.kind === 'noDraw' || p.kind === 'hint')).toBe(false);
  });
  it('Profi: alle Bausteine', () => {
    expect(paletteFor('pro')).toEqual(PALETTE);
    expect(PALETTE.length).toBe(18);
  });
  it('Einfach-Felder einer Plattform: nur Eis', () => {
    const fs = fieldsForMode('simple', fieldsFor(newLevel(), { kind: 'platform', index: 0 }));
    expect(fs.map((f) => f.key)).toEqual(['ice']);
    expect(fieldsForMode('pro', fieldsFor(newLevel(), { kind: 'platform', index: 0 })).length).toBeGreaterThan(1);
  });
  it('Meldungen in einfacher Sprache', () => {
    const [noGift] = levelIssues({ ...newLevel(), gifts: [] });
    expect(friendlyIssue(noGift, 'simple')).toBe('Es fehlt ein Geschenk');
    expect(friendlyIssue(noGift, 'pro')).toBe(noGift.text);
    const [noStation] = levelIssues({ ...newLevel(), stations: [], areas: [], dismounts: [] });
    expect(friendlyIssue(noStation, 'simple')).toBe('Es fehlt eine Station');
    expect(friendlyIssue({ level: 'error', text: 'platforms[0].w muss > 0 sein', ref: null }, 'simple')).toMatch(/Profi/);
    expect(friendlyIssue({ level: 'warning', text: 'Unter dem Startpunkt ist kein Boden', ref: null }, 'simple')).toBe('Unter dem Startpunkt ist kein Boden');
  });
  it('Tinte automatisch nur im Einfach-Modus ohne Handeinstellung', () => {
    expect(autoInkAllowed('simple', false)).toBe(true);
    expect(autoInkAllowed('simple', true)).toBe(false);
    expect(autoInkAllowed('pro', false)).toBe(false);
  });
});
