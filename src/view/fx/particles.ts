import { Particle, ParticleContainer, Rectangle } from 'pixi.js';
import type { Vec2 } from '../../sim/types';
import { softDot } from '../backdrop/util';

const POOL = 700;
const CONFETTI = [0xff4d5e, 0xffd27a, 0x4dff9a, 0x5ec8ff, 0xd07bff, 0xffffff];

interface P { p: Particle; vx: number; vy: number; life: number; max: number; g: number; drag: number; size: number; spin: number }

/**
 * Ein gemeinsamer Partikel-Pool (ParticleContainer, additiv) für Funken,
 * Schneestaub und Konfetti. `amount` = Mengenfaktor der Qualitätsstufe.
 */
export class Particles {
  readonly container: ParticleContainer;
  private readonly free: P[] = [];
  private readonly live: P[] = [];
  amount = 1;

  constructor() {
    this.container = new ParticleContainer({
      dynamicProperties: { position: true, rotation: true, vertex: true, color: true },
      texture: softDot(),
    });
    this.container.blendMode = 'add';
    this.container.boundsArea = new Rectangle(-1e5, -1e5, 2e5, 2e5);
    for (let i = 0; i < POOL; i++) {
      const p = new Particle({ texture: softDot(), anchorX: 0.5, anchorY: 0.5, alpha: 0 });
      this.free.push({ p, vx: 0, vy: 0, life: 0, max: 1, g: 0, drag: 0, size: 1, spin: 0 });
    }
  }

  private count(n: number): number {
    const v = n * this.amount;
    return Math.floor(v) + (Math.random() < v % 1 ? 1 : 0);
  }

  private spawn(x: number, y: number, vx: number, vy: number, life: number, size: number, tint: number, g: number, drag: number): void {
    const q = this.free.pop();
    if (!q) return;
    q.p.x = x;
    q.p.y = y;
    q.p.tint = tint;
    q.p.alpha = 1;
    q.p.rotation = Math.random() * 6.28;
    q.vx = vx;
    q.vy = vy;
    q.life = q.max = life;
    q.size = size;
    q.g = g;
    q.drag = drag;
    q.spin = (Math.random() - 0.5) * 12;
    this.live.push(q);
    this.container.addParticle(q.p);
  }

  /** Funken hinter dem Schlitten; vel = Schlitten-Tempo, intensity 0–1. */
  sparks(pos: Vec2, vel: Vec2, intensity: number): void {
    const n = this.count(1 + intensity * 4);
    for (let i = 0; i < n; i++) {
      const vx = -vel.x * (0.15 + Math.random() * 0.2) + (Math.random() - 0.5) * 120;
      const vy = -Math.random() * 160 * (0.5 + intensity) - vel.y * 0.1;
      const tint = Math.random() < 0.3 ? 0xffffff : Math.random() < 0.5 ? 0xffe08a : 0xffb347;
      this.spawn(pos.x, pos.y, vx, vy, 0.35 + Math.random() * 0.45, 6 + Math.random() * 6 * (0.5 + intensity), tint, 700, 1.5);
    }
  }

  /** Schneestaub (Landung, Absprung, Aufprall). */
  snowPuff(pos: Vec2, strength = 1): void {
    const n = this.count(10 * strength);
    for (let i = 0; i < n; i++) {
      const a = Math.PI + Math.random() * Math.PI;
      const sp = (60 + Math.random() * 160) * strength;
      this.spawn(pos.x + (Math.random() - 0.5) * 20, pos.y, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, 0.45 + Math.random() * 0.4, 7 + Math.random() * 9, 0xbcd0f0, 280, 3);
    }
  }

  /** Goldener Funkenregen (z. B. Geschenk). */
  burst(pos: Vec2, tint = 0xffd27a): void {
    const n = this.count(16);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 220;
      this.spawn(pos.x, pos.y, Math.cos(a) * sp, Math.sin(a) * sp - 60, 0.5 + Math.random() * 0.4, 4 + Math.random() * 5, Math.random() < 0.4 ? 0xffffff : tint, 400, 2);
    }
  }

  /** Konfetti am Ziel. */
  confetti(pos: Vec2): void {
    const n = this.count(90);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const sp = 250 + Math.random() * 450;
      this.spawn(pos.x, pos.y, Math.cos(a) * sp, Math.sin(a) * sp, 1.6 + Math.random() * 1.4, 5 + Math.random() * 5, CONFETTI[i % CONFETTI.length], 420, 1.8);
    }
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const q = this.live[i];
      q.life -= dt;
      if (q.life <= 0) {
        this.container.removeParticle(q.p);
        this.live[i] = this.live[this.live.length - 1];
        this.live.pop();
        this.free.push(q);
        continue;
      }
      const k = Math.exp(-q.drag * dt);
      q.vx *= k;
      q.vy = q.vy * k + q.g * dt;
      q.p.x += q.vx * dt;
      q.p.y += q.vy * dt;
      q.p.rotation += q.spin * dt;
      const u = q.life / q.max;
      q.p.alpha = Math.min(1, u * 2);
      const s = (q.size / 64) * (0.4 + 0.6 * u);
      q.p.scaleX = s;
      q.p.scaleY = s;
    }
  }

  clear(): void {
    for (const q of this.live) { this.container.removeParticle(q.p); this.free.push(q); }
    this.live.length = 0;
  }

  destroy(): void {
    this.container.destroy();
  }
}
