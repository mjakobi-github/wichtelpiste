import { describe, expect, it } from 'vitest';
import { playableError } from './playable';
import { newLevel } from '../editor/template';
import { removeElement } from '../editor/doc';

describe('playableError', () => {
  it('fertiges Level → null', () => expect(playableError(newLevel())).toBeNull());
  it('ohne Geschenk → verständliche Meldung', () => {
    expect(playableError(removeElement(newLevel(), { kind: 'gift', index: 0 }))).toMatch(/noch nicht fertig/);
  });
  it('ohne Station (reines Jump\'n\'Run) → spielbar', () => {
    expect(playableError(removeElement(newLevel(), { kind: 'station', index: 0 }))).toBeNull();
  });
});
