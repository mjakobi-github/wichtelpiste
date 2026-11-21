import { describe, expect, it } from 'vitest';
import { playableError } from './playable';
import { newLevel } from '../editor/template';
import { removeElement } from '../editor/doc';

describe('playableError', () => {
  it('fertiges Level → null', () => expect(playableError(newLevel())).toBeNull());
  it('ohne Station → verständliche Meldung', () => {
    expect(playableError(removeElement(newLevel(), { kind: 'station', index: 0 }))).toMatch(/noch nicht fertig/);
  });
});
