import { describe, expect, it } from 'vitest';
import { Camera } from './camera';

function cam(): Camera {
  const c = new Camera();
  c.resize(1100, 560);
  c.zoom = 1;
  c.updateScale();
  return c;
}

describe('Camera.clampLoose', () => {
  it('lässt die Sicht bis margin über den Rand', () => {
    const c = cam();
    c.cx = -100;
    c.clampLoose({ w: 3000, h: 720 }, 300);
    expect(c.left).toBeCloseTo(-300);
  });
  it('innerhalb bleibt unverändert', () => {
    const c = cam();
    c.cx = 1500;
    c.cy = 400;
    c.clampLoose({ w: 3000, h: 720 }, 300);
    expect([c.cx, c.cy]).toEqual([1500, 400]);
  });
  it('rechts und unten begrenzt', () => {
    const c = cam();
    c.cx = 99999;
    c.cy = 99999;
    c.clampLoose({ w: 3000, h: 720 }, 300);
    expect(c.left + c.viewW).toBeCloseTo(3300);
    expect(c.top + c.viewH).toBeCloseTo(1020);
  });
  it('Welt kleiner als Sicht → Mitte zentriert', () => {
    const c = cam();
    c.zoom = 0.2;
    c.updateScale();
    c.cx = 0;
    c.clampLoose({ w: 1000, h: 500 }, 300);
    expect(c.cx).toBe(500);
  });
});
