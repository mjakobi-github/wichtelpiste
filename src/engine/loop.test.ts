import { describe, expect, it } from 'vitest';
import { Loop } from './loop';

describe('Loop', () => {
  it('höchstens 6 Physik-Ticks pro Frame, auch nach langer Pause', () => {
    let updates = 0;
    let alpha = -1;
    const loop = new Loop(() => updates++, (a) => { alpha = a; });
    loop.advance(5);
    expect(updates).toBeLessThanOrEqual(6);
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeLessThan(1);
  });

  it('normale Frames: ein Tick pro 1/60 s', () => {
    let updates = 0;
    const loop = new Loop(() => updates++, () => {});
    for (let i = 0; i < 60; i++) loop.advance(1 / 60);
    expect(updates).toBeGreaterThanOrEqual(59);
    expect(updates).toBeLessThanOrEqual(60);
  });
});
