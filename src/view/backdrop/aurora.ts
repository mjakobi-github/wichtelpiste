import { Container, Sprite, type Texture } from 'pixi.js';
import { canvasTexture, hslHex, type Layer } from './util';

const FACTOR = 0.08;
const STEP = 7;
const BANDS = 3;

/** Animierte Polarlicht-Bänder (Faktor 0,08); Farbton je Level. */
export class Aurora implements Layer {
  readonly container = new Container();
  private readonly tex: Texture;
  private cols: Sprite[][] = [];
  private readonly tints: number[];

  constructor(hue: number) {
    this.tex = canvasTexture(2, 160, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 160);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(0.22, 'rgba(255,255,255,0.26)');
      gr.addColorStop(0.4, 'rgba(255,255,255,0.12)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 2, 160);
    });
    this.tints = [hslHex(hue, 85, 58), hslHex(hue + 110, 80, 66), hslHex(hue + 30, 85, 62)];
    this.container.blendMode = 'add';
  }

  resize(vw: number): void {
    const n = Math.ceil(vw / STEP) + 3;
    for (let b = 0; b < BANDS; b++) {
      const col = this.cols[b] ?? (this.cols[b] = []);
      while (col.length < n) {
        const s = new Sprite(this.tex);
        s.width = STEP + 1;
        s.tint = this.tints[b];
        col.push(s);
        this.container.addChild(s);
      }
      col.forEach((s, i) => { s.visible = i < n; });
    }
  }

  update(camX: number, dy: number, t: number): void {
    const shift = camX * FACTOR;
    const sub = shift % STEP;
    for (let b = 0; b < BANDS; b++) {
      const col = this.cols[b];
      for (let i = 0; i < col.length; i++) {
        const s = col[i];
        if (!s.visible) continue;
        const x = i * STEP - STEP - sub;
        const wx = x + shift;
        const y = 30 + b * 30 + Math.sin(wx * 0.005 + t * 0.35 + b * 1.7) * 34 + Math.sin(wx * 0.013 - t * 0.6) * 10;
        s.position.set(x, y + dy * 0.3);
        s.height = 120 + 50 * Math.sin(wx * 0.007 + t * 0.4 + b);
        s.alpha = Math.max(0, 0.35 + 0.65 * Math.sin(wx * 0.004 + t * 0.5 + b * 2.1));
      }
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.tex.destroy(true);
  }
}
