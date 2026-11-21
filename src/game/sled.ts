import type { Segment, Vec2 } from './types';

/** Stimmwerte für die Schlitten-Physik (Line-Rider-artig, kein Steering). */
export const SLED_TUNING = {
  radius: 12,           // Kollisionsradius (etwas großzügig = komfortabler Kurführer)
  gravity: 2000,
  maxSpeed: 2200,
  /** Boost darf kurzfristig über maxSpeed hinaus, überschüssiges Tempo verklingt */
  boostMaxSpeed: 3200,
  /** Tempo-Verlust pro Kollisions-Substep bei Bodenkontakt */
  surfaceFriction: 0.9985,
  restitution: 0,       // 0 = kein Abpraller; > 0 später für Sprungfedern
  /** Beschleunigungs-Tinte: Schub pro Sekunde KONTAKT in Zeichenrichtung */
  boostAccel: 2600,
} as const;

/**
 * Schlitten = Punktmasse, die auf Segmenten reitet.
 * Physik-Kern:
 *  - Hangabtrieb ergibt sich natürlich aus Schwerkraft + Normalkraft
 *  - inelastische Kollision (keine Reflexion) an den gezeichneten Linien
 *  - Substeps, damit schnelle Schlitten nicht durch dünne Linien tunneln
 */
export class Sled {
  pos: Vec2 = { x: 0, y: 0 };
  vel: Vec2 = { x: 0, y: 0 };
  /** Anzeigewinkel (aus Geschwindigkeit) – rein fuer die Darstellung */
  angle = 0;

  constructor(spawn: Vec2) {
    this.reset(spawn);
  }

  reset(spawn: Vec2, vel: Vec2 = { x: 0, y: 0 }): void {
    this.pos = { ...spawn };
    this.vel = { ...vel };
    this.angle = Math.atan2(vel.y, vel.x);
  }

  get speed(): number {
    return Math.hypot(this.vel.x, this.vel.y);
  }

  update(dt: number, segments: Segment[], world: { w: number; h: number }): CrashState {
    const kp = SLED_TUNING;

    // Substeps: nicht mehr als ~6 Weltpixel pro Subschritt fahren
    const steps = Math.min(8, Math.max(1, Math.ceil((this.speed * dt) / 6)));
    const sdt = dt / steps;

    for (let i = 0; i < steps; i++) {
      this.vel.y += kp.gravity * sdt;
      // Basis-Cap: darüber bleibt Tempo nur kurz (Boost-Kick) und klingt ab
      const sp = this.speed;
      if (sp > kp.boostMaxSpeed) {
        const f = kp.boostMaxSpeed / sp;
        this.vel.x *= f;
        this.vel.y *= f;
      } else if (sp > kp.maxSpeed) {
        // sanftes Abklingen des Boost-Überschusses Richtung maxSpeed
        const target = Math.max(kp.maxSpeed, sp * 0.995);
        const f = target / sp;
        this.vel.x *= f;
        this.vel.y *= f;
      }
      this.pos.x += this.vel.x * sdt;
      this.pos.y += this.vel.y * sdt;

      for (const seg of segments) this.collideSegment(seg, kp, sdt);
    }

    if (this.speed > 1) this.angle = Math.atan2(this.vel.y, this.vel.x);

    if (this.pos.y > world.h + 240 || this.pos.x < -300 || this.pos.x > world.w + 300) {
      return 'fell';
    }
    return 'alive';
  }

  private collideSegment(seg: Segment, kp: typeof SLED_TUNING, sdt: number): void {
    const r = kp.radius;
    const p = closestPointOnSegment(seg, this.pos);

    let dx = this.pos.x - p.x;
    let dy = this.pos.y - p.y;
    let dist = Math.hypot(dx, dy);

    if (dist >= r) return;

    // Entartete Situation (Punkt exakt auf der Linie): Normale der Linie nehmen
    if (dist < 1e-6) {
      const nx = -(seg.by - seg.ay);
      const ny = seg.bx - seg.ax;
      const nl = Math.hypot(nx, ny) || 1;
      dx = nx / nl; dy = ny / nl; dist = 1e-6;
    }

    const nx = dx / dist;
    const ny = dy / dist;

    // Rausdruecken
    this.pos.x += nx * (r - dist);
    this.pos.y += ny * (r - dist);

    // Normalanteil der Geschwindigkeit entfernen (inelastisch)
    const vn = this.vel.x * nx + this.vel.y * ny;
    if (vn < 0) {
      this.vel.x -= nx * vn * (1 + kp.restitution);
      this.vel.y -= ny * vn * (1 + kp.restitution);
      // Bodenreibung: Geschwindigkeit beim Kontakt leicht dämpfen
      this.vel.x *= kp.surfaceFriction;
      this.vel.y *= kp.surfaceFriction;
    }

    // Beschleunigungs-Tinte: Schub entlang der Zeichenrichtung (a -> b)
    if (seg.boost) {
      const ex = seg.bx - seg.ax;
      const ey = seg.by - seg.ay;
      const len = Math.hypot(ex, ey);
      if (len > 0.001) {
        this.vel.x += (ex / len) * kp.boostAccel * sdt;
        this.vel.y += (ey / len) * kp.boostAccel * sdt;
        const sp2 = this.speed;
        if (sp2 > kp.boostMaxSpeed) {
          this.vel.x *= kp.boostMaxSpeed / sp2;
          this.vel.y *= kp.boostMaxSpeed / sp2;
        }
      }
    }
  }
}

export type CrashState = 'alive' | 'fell';

export function closestPointOnSegment(
  seg: Segment,
  p: Vec2,
): Vec2 {
  const ex = seg.bx - seg.ax;
  const ey = seg.by - seg.ay;
  const length2 = ex * ex + ey * ey;
  if (length2 === 0) return { x: seg.ax, y: seg.ay };
  let t = ((p.x - seg.ax) * ex + (p.y - seg.ay) * ey) / length2;
  t = Math.max(0, Math.min(1, t));
  return { x: seg.ax + ex * t, y: seg.ay + ey * t };
}
