import { Container, Sprite } from 'pixi.js';
import { hardDot, rng, softDot, VH, type Layer } from './util';

interface Flake { s: Sprite; x: number; y: number; ph: number; sp: number; f: number }

const DEPTHS = [
  { n: 70, size: 2.2, alpha: 0.75, speed: 28, factor: 0.5, soft: false },
  { n: 45, size: 3.6, alpha: 0.85, speed: 48, factor: 1, soft: false },
  { n: 12, size: 26, alpha: 0.22, speed: 90, factor: 1.5, soft: true },
];

/** Schneefall in drei Tiefen; die großen, unscharfen Flocken ganz vorne (Faktor 1,5). */
export class ForegroundSnow implements Layer {
  readonly container = new Container();
  private readonly flakes: Flake[] = [];
  private vw = 1000;

  constructor(seed: number, density: number) {
    const r = rng(seed * 5 + 11);
    for (const d of DEPTHS) {
      const n = Math.max(2, Math.round(d.n * density));
      for (let i = 0; i < n; i++) {
        const s = new Sprite(d.soft ? softDot() : hardDot());
        s.anchor.set(0.5);
        const size = d.size * (0.7 + r() * 0.6);
        s.width = s.height = size;
        s.alpha = d.alpha;
        this.flakes.push({ s, x: r() * 2000, y: r() * VH, ph: r() * 6.28, sp: d.speed * (0.8 + r() * 0.4), f: d.factor });
        this.container.addChild(s);
      }
    }
  }

  resize(vw: number): void {
    this.vw = vw;
  }

  update(camX: number, dy: number, t: number): void {
    const W = this.vw + 60;
    const H = VH + 60;
    for (const fl of this.flakes) {
      const x = fl.x + Math.sin(t * 0.8 + fl.ph) * 14 - camX * fl.f * 0.5 + t * 12;
      const y = fl.y + t * fl.sp - dy * fl.f;
      fl.s.position.set((((x % W) + W) % W) - 30, (((y % H) + H) % H) - 30);
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
