import type { Rect, Vec2 } from './types';
import { overlap } from './geometry';

/** Eingabe für den Fuß-Modus. jumpPressed = Flanke seit dem letzten Tick. */
export interface FootInput { move: -1 | 0 | 1; jumpHeld: boolean; jumpPressed: boolean }

/** Was im Tick passiert ist (für Sound/Effekte). landed = Aufprall-Tempo. */
export interface FootEvents { jumped: boolean; landed: number | null }

/** Stimmwerte: knackiger 16-Bit-Sprung (Scheitel ≈ 0,38 s, ≈ 200 px). */
export const PLAYER_TUNING = {
  size: { w: 30, h: 38 },
  maxRunSpeed: 300,
  groundAccel: 3000,
  airAccel: 2200,
  groundFriction: 3500,
  airFriction: 600,
  jumpVelocity: -1050,
  gravity: 2750,
  fallGravity: 3600,
  /** Kurzer Schwebemoment am Scheitel, solange gehalten */
  apexGravityScale: 0.6,
  apexThreshold: 80,
  /** Loslassen im Aufstieg kappt das Aufwärtstempo */
  jumpCutFactor: 0.45,
  maxFallSpeed: 1100,
  coyoteTime: 0.09,
  jumpBuffer: 0.12,
  /** Mindest-Aufwärtstempo einer Sprungfeder zu Fuß */
  springJump: 1400,
} as const;

export class Player {
  pos: Vec2 = { x: 0, y: 0 };
  prevPos: Vec2 = { x: 0, y: 0 };
  vel: Vec2 = { x: 0, y: 0 };
  facing: 1 | -1 = 1;
  grounded = false;

  private coyote = 0;
  private buffer = 0;
  /** true zwischen Absprung und Scheitel/Abbruch – erlaubt genau einen Sprungabbruch */
  private canCut = false;

  constructor(spawn: Vec2) {
    this.respawn(spawn);
  }

  respawn(spawn: Vec2): void {
    this.pos = { ...spawn };
    this.prevPos = { ...spawn };
    this.vel = { x: 0, y: 0 };
    this.facing = 1;
    this.grounded = false;
    this.coyote = 0;
    this.buffer = 0;
    this.canCut = false;
  }

  get aabb(): Rect {
    return { x: this.pos.x, y: this.pos.y, w: PLAYER_TUNING.size.w, h: PLAYER_TUNING.size.h };
  }

  get center(): Vec2 {
    return { x: this.pos.x + PLAYER_TUNING.size.w / 2, y: this.pos.y + PLAYER_TUNING.size.h / 2 };
  }

  /** Sprungfeder: setzt das Tempo; kein Sprungabbruch bis zum Scheitel. */
  launch(vx: number, vy: number): void {
    this.vel = { x: vx, y: vy };
    this.grounded = false;
    this.coyote = 0;
    this.canCut = false;
  }

  update(dt: number, input: FootInput, solids: Rect[]): FootEvents {
    const k = PLAYER_TUNING;
    const ev: FootEvents = { jumped: false, landed: null };
    this.prevPos = { ...this.pos };

    // Horizontal
    const target = input.move * k.maxRunSpeed;
    const accel = input.move !== 0
      ? (this.grounded ? k.groundAccel : k.airAccel)
      : (this.grounded ? k.groundFriction : k.airFriction);
    this.vel.x = approach(this.vel.x, target, accel * dt);
    if (input.move !== 0) this.facing = input.move > 0 ? 1 : -1;

    // Puffer & Coyote
    if (input.jumpPressed) this.buffer = k.jumpBuffer;
    if (this.grounded) this.coyote = k.coyoteTime;

    if (this.buffer > 0 && this.coyote > 0) {
      this.vel.y = k.jumpVelocity;
      this.buffer = 0;
      this.coyote = 0;
      this.grounded = false;
      this.canCut = true;
      ev.jumped = true;
    }

    // Sprungabbruch beim Loslassen
    if (this.canCut && !input.jumpHeld && this.vel.y < 0) {
      this.vel.y *= k.jumpCutFactor;
      this.canCut = false;
    }
    if (this.vel.y >= 0) this.canCut = false;

    // Schwerkraft
    let g: number;
    if (this.vel.y < 0) g = k.gravity;
    else g = k.fallGravity;
    if (Math.abs(this.vel.y) < k.apexThreshold && input.jumpHeld && !this.grounded) g = k.gravity * k.apexGravityScale;
    this.vel.y = Math.min(this.vel.y + g * dt, k.maxFallSpeed);

    this.buffer = Math.max(0, this.buffer - dt);
    if (!this.grounded) this.coyote = Math.max(0, this.coyote - dt);

    // Kollision: erst X, dann Y
    this.pos.x += this.vel.x * dt;
    this.solve(solids, 'x');

    const wasGrounded = this.grounded;
    const impact = this.vel.y;
    this.grounded = false;
    this.pos.y += this.vel.y * dt;
    this.solve(solids, 'y');
    if (this.grounded && !wasGrounded) ev.landed = impact;

    return ev;
  }

  private solve(solids: Rect[], axis: 'x' | 'y'): void {
    const { w, h } = PLAYER_TUNING.size;
    for (const s of solids) {
      if (!overlap(this.aabb, s)) continue;
      if (axis === 'x') {
        if (this.vel.x > 0) this.pos.x = s.x - w;
        else if (this.vel.x < 0) this.pos.x = s.x + s.w;
        this.vel.x = 0;
      } else if (this.vel.y > 0) {
        this.pos.y = s.y - h;
        this.vel.y = 0;
        this.grounded = true;
      } else if (this.vel.y < 0) {
        this.pos.y = s.y + s.h;
        this.vel.y = 0;
      }
    }
  }
}

export function approach(value: number, target: number, maxDelta: number): number {
  return value < target ? Math.min(value + maxDelta, target) : Math.max(value - maxDelta, target);
}
