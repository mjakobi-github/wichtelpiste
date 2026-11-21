import { Container, Sprite, type Texture } from 'pixi.js';
import { canvasTexture, rng, type Layer } from './util';

const FACTOR = 0.02;

/** Mond mit Lichthof (Faktor 0,02). */
export class Moon implements Layer {
  readonly container = new Container();
  private readonly tex: Texture;
  private readonly sprite: Sprite;
  private vw = 1000;

  constructor(seed: number) {
    const r = rng(seed * 7 + 1);
    this.tex = canvasTexture(240, 240, (g) => {
      const c = 120;
      const halo = g.createRadialGradient(c, c, 20, c, c, 120);
      halo.addColorStop(0, 'rgba(255,240,200,0.5)');
      halo.addColorStop(0.35, 'rgba(255,236,190,0.16)');
      halo.addColorStop(1, 'rgba(255,236,190,0)');
      g.fillStyle = halo;
      g.fillRect(0, 0, 240, 240);
      const disc = g.createRadialGradient(c - 8, c - 8, 4, c, c, 28);
      disc.addColorStop(0, '#fffaea');
      disc.addColorStop(1, '#f3e3b8');
      g.fillStyle = disc;
      g.beginPath();
      g.arc(c, c, 28, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(190,170,130,0.35)';
      for (let i = 0; i < 6; i++) {
        const a = r() * Math.PI * 2;
        const d = r() * 18;
        g.beginPath();
        g.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, 2 + r() * 5, 0, Math.PI * 2);
        g.fill();
      }
    });
    this.sprite = new Sprite(this.tex);
    this.sprite.anchor.set(0.5);
    this.container.addChild(this.sprite);
    this.side = 0.62 + r() * 0.25;
  }

  private readonly side: number;

  resize(vw: number): void {
    this.vw = vw;
  }

  update(camX: number, dy: number): void {
    this.sprite.position.set(this.vw * this.side - Math.min(camX * FACTOR, 140), 92 + dy * 0.1);
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.tex.destroy(true);
  }
}
