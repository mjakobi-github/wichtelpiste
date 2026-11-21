import type { LevelData, Platform, Vec2 } from './types';
import type { PlayerInput } from '../engine/input';

/** Stimmwerte fuer den Fuss-Modus – hier wird am "Feel" gedreht (Tag 2). */
export const TUNING = {
  size: { w: 30, h: 38 },
  maxRunSpeed: 300,
  groundAccel: 2400,
  airAccel: 1600,
  groundFriction: 2600,
  airFriction: 250,
  /** Halten = niedrigere Gravitation -> variable Sprunghoehe */
  gravityUp: 1250,
  gravityDown: 2200,
  maxFallSpeed: 950,
  jumpVelocity: -720,
  /** Coyote-Time: knapp nach der Kante abspringen ist erlaubt */
  coyoteTime: 0.09,
} as const;

export class Player {
  /** Optionaler Hook (vom Spiel gesetzt, z. B. für Jump-Sound). */
  onJump: (() => void) | null = null;

  pos: Vec2 = { x: 0, y: 0 };
  vel: Vec2 = { x: 0, y: 0 };
  facing: 1 | -1 = 1;
  grounded = false;
  private coyote = 0;

  constructor(spawn: Vec2) {
    this.respawn(spawn);
  }

  respawn(spawn: Vec2): void {
    this.pos = { ...spawn };
    this.vel = { x: 0, y: 0 };
    this.facing = 1;
    this.grounded = false;
    this.coyote = 0;
  }

  get aabb(): { x: number; y: number; w: number; h: number } {
    return { x: this.pos.x, y: this.pos.y, w: TUNING.size.w, h: TUNING.size.h };
  }

  get center(): Vec2 {
    return {
      x: this.pos.x + TUNING.size.w / 2,
      y: this.pos.y + TUNING.size.h / 2,
    };
  }

  update(dt: number, input: PlayerInput, level: LevelData): void {
    const kp = TUNING;
    const onGround = this.grounded;

    // --- Horizontal: Beschleunigung / Reibung ---
    const target = input.move * kp.maxRunSpeed;
    const accel =
      input.move !== 0
        ? (onGround ? kp.groundAccel : kp.airAccel)
        : (onGround ? kp.groundFriction : kp.airFriction);
    this.vel.x = approach(this.vel.x, target, accel * dt);
    if (input.move !== 0) this.facing = input.move > 0 ? 1 : -1;

    // --- Vertikal: variable Gravitation (Halten = höherer Sprung) ---
    const gravity =
      this.vel.y < 0 && input.jumpHeld ? kp.gravityUp : kp.gravityDown;
    this.vel.y = Math.min(this.vel.y + gravity * dt, kp.maxFallSpeed);

    // --- Coyote-Time vorbereiten ---
    if (onGround) this.coyote = kp.coyoteTime;
    else this.coyote = Math.max(0, this.coyote - dt);

    // --- Sprung ---
    if (input.jumpHeld && this.coyote > 0) {
      this.vel.y = kp.jumpVelocity;
      this.coyote = 0;
      this.grounded = false; // sofort heben, damit nicht doppelt ausgeloest
      this.onJump?.();
    }

    // --- Kollision: zuerst X, dann Y (klassische Achsen-Trennung) ---
    this.pos.x += this.vel.x * dt;
    this.solveAxis(level.platforms, 'x');

    // grounded gilt nur fuer diesen Schritt; erst Kollision in Y setzt ihn wieder
    this.grounded = false;
    this.pos.y += this.vel.y * dt;
    this.solveAxis(level.platforms, 'y');
  }

  /** AABB-vs-Rechteck-Aufloesung auf einer Achse. */
  private solveAxis(platforms: Platform[], axis: 'x' | 'y'): void {
    const a = this.aabb;
    for (const p of platforms) {
      if (!overlap(a, p)) continue;
      if (axis === 'x') {
        if (this.vel.x > 0) this.pos.x = p.x - TUNING.size.w;
        else if (this.vel.x < 0) this.pos.x = p.x + p.w;
        this.vel.x = 0;
      } else {
        if (this.vel.y > 0) {
          this.pos.y = p.y - TUNING.size.h;
          this.vel.y = 0;
          this.grounded = true;
        } else if (this.vel.y < 0) {
          this.pos.y = p.y + p.h;
          this.vel.y = 0;
        }
      }
    }
  }

}

// ---------- kleine Math-Helfer ----------

export function approach(value: number, target: number, maxDelta: number): number {
  if (value < target) return Math.min(value + maxDelta, target);
  return Math.max(value - maxDelta, target);
}

export function overlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}
