import { describe, expect, it } from 'vitest';
import { canPause, formatInk, nextScreen } from './flow';

describe('nextScreen', () => {
  it.each([
    ['title', 'start', 'levels'],
    ['levels', 'pickLevel', 'play'],
    ['play', 'pause', 'pause'],
    ['pause', 'resume', 'play'],
    ['pause', 'toLevels', 'levels'],
    ['pause', 'restart', 'play'],
    ['play', 'win', 'won'],
    ['won', 'next', 'play'],
    ['won', 'again', 'play'],
    ['won', 'toLevels', 'levels'],
    ['title', 'openEditor', 'editor'],
    ['editor', 'testPlay', 'play'],
    ['play', 'toEditor', 'editor'],
    ['pause', 'toEditor', 'editor'],
    ['won', 'toEditor', 'editor'],
    ['editor', 'toLevels', 'levels'],
  ] as const)('%s + %s → %s', (s, a, want) => {
    expect(nextScreen(s, a)).toBe(want);
  });

  it('ignoriert unpassende Aktionen', () => {
    expect(nextScreen('title', 'win')).toBe('title');
    expect(nextScreen('levels', 'resume')).toBe('levels');
    expect(nextScreen('won', 'pause')).toBe('won');
  });
});

describe('formatInk', () => {
  it('zeigt — ohne Wert', () => expect(formatInk(null)).toBe('—'));
  it('setzt Tausenderpunkte', () => {
    expect(formatInk(1234)).toBe('1.234');
    expect(formatInk(987)).toBe('987');
    expect(formatInk(1234567.4)).toBe('1.234.567');
  });
});

describe('canPause', () => {
  it('nur im Spiel und nicht nach dem Sieg', () => {
    expect(canPause('play', false)).toBe(true);
    expect(canPause('play', true)).toBe(false);
    expect(canPause('won', false)).toBe(false);
    expect(canPause('levels', false)).toBe(false);
  });
});
