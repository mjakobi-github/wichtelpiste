import type { Vec2 } from '../game/types';

/**
 * Weiche Kamera-Verfolgung mit Lookahead und Klemmung an die Weltränder.
 * Der Lookahead wird von außen vorgegeben:
 *  - Fuß-Modus: Blickrichtung * 70
 *  - Schlitten: Richtung+Geschwindigkeit (bis max. 260 vor uns)
 */
export class Camera {
  /** linke obere Ecke des Viewports in Weltkoordinaten */
  x = 0;
  y = 0;

  update(
    targetCenter: Vec2,
    lookahead: number,
    dt: number,
    view: { w: number; h: number },
    world: { w: number; h: number },
  ): void {
    const kp = 6;             // Verfolgungsgeschwindigkeit (exponentiell)
    const kpY = 4;

    const tx = targetCenter.x + lookahead - view.w / 2;
    const ty = targetCenter.y - view.h * 0.55;

    // framerate-unabhaengiges Lerp
    this.x += (tx - this.x) * (1 - Math.exp(-kp * dt));
    this.y += (ty - this.y) * (1 - Math.exp(-kpY * dt));

    this.x = clamp(this.x, 0, Math.max(0, world.w - view.w));
    this.y = clamp(this.y, -200, Math.max(0, world.h - view.h));
  }
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
