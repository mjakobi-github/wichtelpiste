import { describe, expect, it } from 'vitest';
import { Shake } from './shake';

describe('Shake', () => {
  it('bleibt nach kick(8) innerhalb von 8 px', () => {
    const s = new Shake();
    s.kick(8);
    for (let t = 0; t < 0.4; t += 0.01) {
      const o = s.offset(t);
      expect(Math.hypot(o.x, o.y)).toBeLessThanOrEqual(8 + 1e-9);
      s.update(0.01);
    }
  });

  it('ist nach 0,4 s abgeklungen', () => {
    const s = new Shake();
    s.kick(8);
    expect(Math.hypot(s.offset(0.05).x, s.offset(0.05).y)).toBeGreaterThan(0);
    s.update(0.4);
    expect(s.offset(1)).toEqual({ x: 0, y: 0 });
  });

  it('nimmt beim erneuten Kick die stärkere Erschütterung', () => {
    const s = new Shake();
    s.kick(8);
    s.kick(3);
    s.update(0.01);
    let max = 0;
    for (let t = 0; t < 1; t += 0.013) max = Math.max(max, Math.hypot(s.offset(t).x, s.offset(t).y));
    expect(max).toBeGreaterThan(3);
  });
});
