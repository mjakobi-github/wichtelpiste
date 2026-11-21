import { describe, expect, it } from 'vitest';
import { layoutFor } from './layout';

describe('layoutFor', () => {
  it.each([[844, 390, 'phone'], [1400, 800, 'desktop'], [1100, 480, 'phone'], [900, 700, 'phone'], [1280, 720, 'desktop']] as const)('%i×%i → %s', (w, h, want) => {
    expect(layoutFor(w, h)).toBe(want);
  });
});
