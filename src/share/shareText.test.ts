import { describe, expect, it } from 'vitest';
import { shareText } from './shareText';
import { LEVELS } from '../levels';

describe('shareText', () => {
  it('mit Rekord', () => {
    expect(shareText({ level: { ...LEVELS[0], name: 'Schneeberg' }, from: 'Lena', challengeInk: 1412 }))
      .toBe('Ich hab ein Wichtelpiste-Level für dich gebaut: Schneeberg. Schlag meine 1.412!');
  });
  it('ohne Rekord', () => {
    expect(shareText({ level: { ...LEVELS[0], name: 'Schneeberg' }, from: '', challengeInk: null }))
      .toBe('Ich hab ein Wichtelpiste-Level für dich gebaut: Schneeberg.');
  });
});
