import type { Vec2 } from '../../sim/types';

const DURATION = 0.4;

/** Kamera-Erschütterung: kick(px) setzt die Stärke, klingt in 0,4 s quadratisch ab. */
export class Shake {
  private strength = 0;
  private left = 0;

  kick(strength: number): void {
    const now = this.current();
    if (strength >= now) {
      this.strength = strength;
      this.left = DURATION;
    }
  }

  update(dt: number): void {
    this.left = Math.max(0, this.left - dt);
  }

  /** Versatz zur Zeit time (s); Betrag ≤ aktuelle Stärke. */
  offset(time: number): Vec2 {
    const s = this.current();
    if (s <= 0) return { x: 0, y: 0 };
    const x = Math.sin(time * 71) * 0.6 + Math.sin(time * 113 + 1.3) * 0.4;
    const y = Math.sin(time * 89 + 0.7) * 0.6 + Math.sin(time * 131 + 2.1) * 0.4;
    const len = Math.hypot(x, y);
    const k = len > 1 ? s / len : s;
    return { x: x * k, y: y * k };
  }

  private current(): number {
    const f = this.left / DURATION;
    return this.strength * f * f;
  }
}
