import { Container, Graphics, Sprite } from 'pixi.js';
import { hardDot, parallaxOffset, rng, softDot, type Layer } from './util';

const PERIOD = 2400;
const FACTOR = 0.04;

interface Star { s: Sprite; x: number; y: number; phase: number; speed: number; base: number }

/** Funkelnde Sterne (Faktor 0,04) und gelegentlich eine Sternschnuppe. */
export class Stars implements Layer {
  readonly container = new Container();
  private readonly stars: Star[] = [];
  private readonly shoot = new Graphics();
  private vw = 1000;
  private next: number;
  private shot: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
  private readonly r: () => number;

  constructor(seed: number, density: number) {
    this.r = rng(seed * 31 + 5);
    const n = Math.round(220 * density);
    for (let i = 0; i < n; i++) {
      const big = this.r() < 0.08;
      const s = new Sprite(big ? softDot() : hardDot());
      s.anchor.set(0.5);
      const size = big ? 6 + this.r() * 6 : 1 + this.r() * 2.2;
      s.width = s.height = size;
      s.tint = this.r() < 0.2 ? 0xffe7b0 : this.r() < 0.3 ? 0xbfd8ff : 0xffffff;
      // dichter oben, dünner zum Horizont
      const y = Math.pow(this.r(), 1.6) * 330;
      this.stars.push({ s, x: this.r() * PERIOD, y, phase: this.r() * 6.28, speed: 0.6 + this.r() * 2, base: big ? 0.5 : 0.35 + this.r() * 0.4 });
      this.container.addChild(s);
    }
    this.shoot.blendMode = 'add';
    this.container.addChild(this.shoot);
    this.next = 4 + this.r() * 6;
  }

  resize(vw: number): void {
    this.vw = vw;
  }

  update(camX: number, dy: number, t: number): void {
    const off = parallaxOffset(camX, FACTOR, PERIOD);
    for (const st of this.stars) {
      let x = st.x - off;
      if (x < -10) x += PERIOD;
      st.s.visible = x < this.vw + 10;
      if (!st.s.visible) continue;
      st.s.position.set(x, st.y + dy * 0.2);
      st.s.alpha = st.base + (1 - st.base) * Math.abs(Math.sin(t * st.speed + st.phase));
    }
    this.updateShootingStar(t);
  }

  private last = 0;
  private updateShootingStar(t: number): void {
    const dt = Math.min(0.1, Math.max(0, t - this.last));
    this.last = t;
    const g = this.shoot.clear();
    if (!this.shot && t > this.next) {
      this.shot = { x: this.vw * (0.2 + this.r() * 0.7), y: 20 + this.r() * 120, vx: -(500 + this.r() * 300), vy: 160 + this.r() * 100, life: 1 };
      this.next = t + 7 + this.r() * 12;
    }
    const s = this.shot;
    if (!s) return;
    s.life -= dt * 1.4;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.life <= 0) { this.shot = null; return; }
    const tail = 0.18;
    g.moveTo(s.x, s.y).lineTo(s.x - s.vx * tail, s.y - s.vy * tail).stroke({ width: 2, color: 0xdfeaff, alpha: s.life, cap: 'round' });
    g.circle(s.x, s.y, 2).fill({ color: 0xffffff, alpha: s.life });
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
