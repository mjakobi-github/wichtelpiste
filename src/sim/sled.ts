import type { Segment, Vec2 } from './types';
import { closestPointOnSegment } from './geometry';

/** Stimmwerte des Schlittens (Line-Rider-artig, keine Steuerung). */
export const SLED_TUNING = {
  /** Kollisionsradius je Kufen-Ende */
  pointRadius: 5,
  /** Abstand der beiden Kufen-Enden */
  length: 22,
  gravity: 2000,
  /** Anteil des Tempos, der pro Sekunde Kontakt verloren geht */
  friction: 0.04,
  maxSpeed: 2200,
  boostMaxSpeed: 3200,
  boostAccel: 2600,
  /** Anteil des Überschusses über maxSpeed, der pro Sekunde abgebaut wird */
  overspeedDecay: 0.5,
  /** Höchstens so viele Pixel pro Unterschritt (< pointRadius → kein Tunneln) */
  maxStepTravel: 4,
  maxSubsteps: 16,
} as const;

interface Pt { p: Vec2; v: Vec2; prev: Vec2; contact: boolean; boostDir: Vec2 | null }

/**
 * Schlitten als Zwei-Punkt-Körper (hinteres + vorderes Kufen-Ende) mit
 * positionsbasierter Physik: Punkte bewegen sich frei, werden aus Linien
 * herausgedrückt (nie herangezogen) und über eine Abstandsbedingung verbunden.
 * Reibung wirkt zeitbasiert einmal pro Punkt und Unterschritt.
 */
export class Sled {
  private rearPt: Pt = mkPt();
  private frontPt: Pt = mkPt();
  private prevMid: Vec2 = { x: 0, y: 0 };
  private air = 0;
  private touching = false;

  get rear(): Vec2 { return this.rearPt.p; }
  get front(): Vec2 { return this.frontPt.p; }
  get pos(): Vec2 { return mid(this.rearPt.p, this.frontPt.p); }
  get prevPos(): Vec2 { return this.prevMid; }
  get vel(): Vec2 { return mid(this.rearPt.v, this.frontPt.v); }
  get speed(): number { const v = this.vel; return Math.hypot(v.x, v.y); }
  get angle(): number {
    const a = this.rearPt.p;
    const b = this.frontPt.p;
    return Math.atan2(b.y - a.y, b.x - a.x);
  }
  get grounded(): boolean { return this.touching; }
  get airTime(): number { return this.air; }

  reset(pos: Vec2, vel: Vec2 = { x: 0, y: 0 }, facing: 1 | -1 = 1): void {
    const h = (SLED_TUNING.length / 2) * facing;
    this.rearPt = mkPt({ x: pos.x - h, y: pos.y }, vel);
    this.frontPt = mkPt({ x: pos.x + h, y: pos.y }, vel);
    this.prevMid = { ...pos };
    this.air = 0;
    this.touching = false;
  }

  /** Sprungfeder: setzt das Tempo beider Kufen-Enden. */
  launch(vx: number, vy: number): void {
    for (const q of [this.rearPt, this.frontPt]) q.v = { x: vx, y: vy };
    this.clampSpeed(0);
  }

  update(dt: number, segments: Segment[]): void {
    const k = SLED_TUNING;
    this.prevMid = this.pos;
    const steps = Math.min(k.maxSubsteps, Math.max(1, Math.ceil((this.maxPointSpeed() * dt) / k.maxStepTravel)));
    const sdt = dt / steps;
    let touchedAny = false;

    for (let s = 0; s < steps; s++) {
      for (const q of [this.rearPt, this.frontPt]) {
        q.v.y += k.gravity * sdt;
        if (q.boostDir) {
          q.v.x += q.boostDir.x * k.boostAccel * sdt;
          q.v.y += q.boostDir.y * k.boostAccel * sdt;
        }
        q.prev = { ...q.p };
        q.p.x += q.v.x * sdt;
        q.p.y += q.v.y * sdt;
      }

      // Abstandsbedingung + Kollision, zwei Durchgänge für stabile Ecken
      const normals: (Vec2 | null)[] = [null, null];
      const boosts: (Vec2 | null)[] = [null, null];
      for (let it = 0; it < 2; it++) {
        this.solveLength();
        [this.rearPt, this.frontPt].forEach((q, i) => {
          const hit = collide(q, segments);
          if (hit) {
            normals[i] = hit.n;
            if (hit.boost) boosts[i] = hit.boost;
          }
        });
      }
      this.rearPt.boostDir = boosts[0];
      this.frontPt.boostDir = boosts[1];

      // Geschwindigkeit aus der Positionsänderung; Normalanteil an Kontakten entfernen, Reibung
      [this.rearPt, this.frontPt].forEach((q, i) => {
        q.v = { x: (q.p.x - q.prev.x) / sdt, y: (q.p.y - q.prev.y) / sdt };
        const n = normals[i];
        q.contact = n !== null;
        if (n) {
          const vn = q.v.x * n.x + q.v.y * n.y;
          if (vn > 0) { q.v.x -= n.x * vn; q.v.y -= n.y * vn; }
          const f = 1 - k.friction * sdt;
          q.v.x *= f;
          q.v.y *= f;
          touchedAny = true;
        }
      });
      this.clampSpeed(sdt);
    }

    this.touching = touchedAny;
    this.air = touchedAny ? 0 : this.air + dt;
  }

  private maxPointSpeed(): number {
    return Math.max(Math.hypot(this.rearPt.v.x, this.rearPt.v.y), Math.hypot(this.frontPt.v.x, this.frontPt.v.y));
  }

  private solveLength(): void {
    const a = this.rearPt.p;
    const b = this.frontPt.p;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1e-6;
    const diff = (d - SLED_TUNING.length) / d / 2;
    a.x += dx * diff; a.y += dy * diff;
    b.x -= dx * diff; b.y -= dy * diff;
  }

  /** Höchsttempo: hartes Limit boostMaxSpeed, darüber maxSpeed klingt der Überschuss ab. */
  private clampSpeed(sdt: number): void {
    const k = SLED_TUNING;
    for (const q of [this.rearPt, this.frontPt]) {
      const sp = Math.hypot(q.v.x, q.v.y);
      let target = sp;
      if (sp > k.maxSpeed) target = Math.max(k.maxSpeed, sp - (sp - k.maxSpeed) * k.overspeedDecay * sdt);
      target = Math.min(target, k.boostMaxSpeed);
      if (target < sp) {
        const f = target / sp;
        q.v.x *= f;
        q.v.y *= f;
      }
    }
  }
}

function mkPt(p: Vec2 = { x: 0, y: 0 }, v: Vec2 = { x: 0, y: 0 }): Pt {
  return { p: { ...p }, v: { ...v }, prev: { ...p }, contact: false, boostDir: null };
}

function mid(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Drückt den Punkt aus der am tiefsten eindringenden Linie heraus (nur diese eine).
 * Die Normale zeigt zur Seite, auf der der Punkt ist (= von der er kommt, da kein Tunneln).
 * Liefert Normale und ggf. Boost-Richtung (a → b) der Kontaktlinie, oder null.
 */
function collide(q: Pt, segments: Segment[]): { n: Vec2; boost: Vec2 | null } | null {
  const r = SLED_TUNING.pointRadius;
  let best: Segment | null = null;
  let bestD: number = r;
  let bestC: Vec2 | null = null;
  for (const s of segments) {
    // grober Ausschluss über die Bounding-Box
    if (q.p.x < Math.min(s.ax, s.bx) - r || q.p.x > Math.max(s.ax, s.bx) + r) continue;
    if (q.p.y < Math.min(s.ay, s.by) - r || q.p.y > Math.max(s.ay, s.by) + r) continue;
    const c = closestPointOnSegment(s, q.p);
    const d = Math.hypot(q.p.x - c.x, q.p.y - c.y);
    if (d < bestD) { bestD = d; best = s; bestC = c; }
  }
  if (!best || !bestC) return null;
  let nx: number;
  let ny: number;
  if (bestD > 1e-6) {
    nx = (q.p.x - bestC.x) / bestD;
    ny = (q.p.y - bestC.y) / bestD;
  } else {
    // exakt auf der Linie: Seite der Vorposition nehmen
    const ex = best.bx - best.ax;
    const ey = best.by - best.ay;
    const len = Math.hypot(ex, ey) || 1;
    nx = -ey / len; ny = ex / len;
    if ((q.prev.x - bestC.x) * nx + (q.prev.y - bestC.y) * ny < 0) { nx = -nx; ny = -ny; }
  }
  q.p.x += nx * (r - bestD);
  q.p.y += ny * (r - bestD);
  let boost: Vec2 | null = null;
  if (best.boost) {
    const ex = best.bx - best.ax;
    const ey = best.by - best.ay;
    const len = Math.hypot(ex, ey);
    if (len > 0) boost = { x: ex / len, y: ey / len };
  }
  return { n: { x: nx, y: ny }, boost };
}
