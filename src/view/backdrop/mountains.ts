import { Container, TilingSprite, type Texture } from 'pixi.js';
import { canvasTexture, mountainProfile, MOUNTAIN_STEP, parallaxOffset, rng, VH, type Layer } from './util';

const PERIOD = 1600;

interface Range { sprite: TilingSprite; tex: Texture; factor: number; vy: number }

/** Ferne Berge mit Schneekämmen und Dunst; zwei Ketten (0,12 und 0,18), einmal vorgerendert, gekachelt. */
export class Mountains implements Layer {
  readonly container = new Container();
  private readonly ranges: Range[] = [];

  constructor(seed: number, hue: number) {
    this.ranges.push(this.range(seed * 13 + 2, 0.12, 250, 70, ['#232a66', '#1a1f52'], 0.22, hue));
    this.ranges.push(this.range(seed, 0.18, 315, 95, ['#2a3070', '#12153c'], 0.38, hue));
  }

  private range(seed: number, factor: number, base: number, amp: number, fill: [string, string], snow: number, hue: number): Range {
    const prof = mountainProfile(seed, PERIOD, base, amp);
    const r = rng(seed + 99);
    const tex = canvasTexture(PERIOD, VH, (g) => {
      const path = () => {
        g.beginPath();
        g.moveTo(0, VH);
        prof.forEach((y, i) => g.lineTo(i * MOUNTAIN_STEP, y));
        g.lineTo(PERIOD, VH);
        g.closePath();
      };
      const top = Math.min(...prof);
      const gr = g.createLinearGradient(0, top, 0, VH);
      gr.addColorStop(0, fill[0]);
      gr.addColorStop(1, fill[1]);
      path();
      g.fillStyle = gr;
      g.fill();

      // Schneekappen: oberhalb einer Linie knapp unter jedem Grat, gezackter Rand
      g.save();
      path();
      g.clip();
      g.fillStyle = `rgba(225,235,255,${snow})`;
      g.beginPath();
      g.moveTo(0, prof[0]);
      prof.forEach((y, i) => g.lineTo(i * MOUNTAIN_STEP, y));
      for (let i = prof.length - 1; i >= 0; i--) {
        const depth = 10 + (base - prof[i]) * 0.45 + r() * 10;
        g.lineTo(i * MOUNTAIN_STEP, prof[i] + Math.max(4, depth));
      }
      g.closePath();
      g.fill();
      // Mondlicht von rechts: helle Flanken
      g.strokeStyle = 'rgba(230,238,255,0.45)';
      g.lineWidth = 1.5;
      g.beginPath();
      prof.forEach((y, i) => (i ? g.lineTo(i * MOUNTAIN_STEP, y) : g.moveTo(0, y)));
      g.stroke();
      g.restore();

      // Dunst vor dem Fuß
      const haze = g.createLinearGradient(0, base - 20, 0, VH);
      haze.addColorStop(0, `hsla(${hue + 120},60%,65%,0)`);
      haze.addColorStop(1, `hsla(${hue + 120},60%,65%,0.22)`);
      g.fillStyle = haze;
      g.fillRect(0, base - 20, PERIOD, VH);
    });
    const sprite = new TilingSprite({ texture: tex, width: 100, height: VH });
    this.container.addChild(sprite);
    return { sprite, tex, factor, vy: factor };
  }

  resize(vw: number): void {
    for (const r of this.ranges) r.sprite.width = vw;
  }

  update(camX: number, dy: number): void {
    for (const r of this.ranges) {
      r.sprite.tilePosition.x = -parallaxOffset(camX, r.factor, PERIOD);
      r.sprite.y = dy * r.vy * 2 + 20;
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
    for (const r of this.ranges) r.tex.destroy(true);
  }
}
