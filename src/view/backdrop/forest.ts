import { Container, TilingSprite, type Texture } from 'pixi.js';
import { canvasTexture, parallaxOffset, rng, VH, type Layer } from './util';

const PERIOD = 1400;
const FACTOR = 0.45;
const GROUND = 470;

/** Verschneiter Tannenwald mit fernen Häusern und warmen Fenstern (Faktor 0,45). */
export class Forest implements Layer {
  readonly container = new Container();
  private readonly tex: Texture;
  private readonly sprite: TilingSprite;

  constructor(seed: number) {
    const r = rng(seed * 17 + 3);
    this.tex = canvasTexture(PERIOD, VH, (g) => {
      // flache Schneehügel als Boden
      g.fillStyle = '#121741';
      g.beginPath();
      g.moveTo(0, VH);
      for (let x = 0; x <= PERIOD; x += 20) g.lineTo(x, GROUND - 14 + Math.sin((x / PERIOD) * Math.PI * 4) * 8 + Math.sin((x / PERIOD) * Math.PI * 10) * 4);
      g.lineTo(PERIOD, VH);
      g.fill();

      // ferne Häuser
      const houses = 3 + Math.floor(r() * 3);
      for (let i = 0; i < houses; i++) this.house(g, r, 80 + r() * (PERIOD - 200));

      // Tannen: hinten klein/dunkel, vorne größer
      const trees = Array.from({ length: 70 }, () => ({ x: r() * PERIOD, s: 0.45 + r() * 0.75 })).sort((a, b) => a.s - b.s);
      for (const tr of trees) for (const off of [-PERIOD, 0, PERIOD]) this.tree(g, tr.x + off, tr.s);

      // Talgrund: läuft ins Dunkle aus (soll nicht wie begehbarer Boden wirken)
      const gr = g.createLinearGradient(0, GROUND - 20, 0, VH);
      gr.addColorStop(0, 'rgba(14,18,54,0)');
      gr.addColorStop(0.35, 'rgba(10,12,40,0.85)');
      gr.addColorStop(1, '#04051a');
      g.fillStyle = gr;
      g.fillRect(0, GROUND - 20, PERIOD, VH - GROUND + 20);
    });
    this.sprite = new TilingSprite({ texture: this.tex, width: 100, height: VH });
    this.container.addChild(this.sprite);
  }

  private tree(g: CanvasRenderingContext2D, x: number, s: number): void {
    if (x < -60 || x > PERIOD + 60) return;
    const base = GROUND - s * 12;
    const h = 100 * s;
    const w = 36 * s;
    const shade = Math.round(10 + s * 10);
    g.fillStyle = `rgb(${shade},${shade + 10},${shade + 40})`;
    g.fillRect(x - 2 * s, base - 6 * s, 4 * s, 8 * s);
    for (let l = 0; l < 4; l++) {
      const ty = base - h + l * h * 0.22;
      const by = base - h * 0.42 + l * h * 0.22 - 6 * s;
      const hw = w * (0.45 + l * 0.2);
      g.fillStyle = `rgb(${shade},${shade + 10},${shade + 40})`;
      g.beginPath();
      g.moveTo(x, ty);
      g.lineTo(x - hw, by);
      g.lineTo(x + hw, by);
      g.fill();
      // Schnee auf den Ästen
      g.fillStyle = `rgba(225,236,255,${0.35 + s * 0.3})`;
      g.beginPath();
      g.moveTo(x - hw * 0.9, by - 1);
      g.quadraticCurveTo(x - hw * 0.4, by - 7 * s, x, by - 3 * s);
      g.quadraticCurveTo(x + hw * 0.5, by - 6 * s, x + hw * 0.95, by - 1);
      g.lineTo(x + hw * 0.6, by + 2 * s);
      g.lineTo(x - hw * 0.6, by + 2 * s);
      g.fill();
    }
    g.fillStyle = `rgba(235,242,255,${0.5 + s * 0.3})`;
    g.beginPath();
    g.moveTo(x, base - h);
    g.lineTo(x - w * 0.2, base - h * 0.85);
    g.lineTo(x + w * 0.2, base - h * 0.85);
    g.fill();
  }

  private house(g: CanvasRenderingContext2D, r: () => number, x: number): void {
    const w = 46 + r() * 40;
    const h = 30 + r() * 24;
    const y = GROUND - h - 8;
    g.fillStyle = '#1b2052';
    g.fillRect(x, y, w, h + 10);
    // Dach
    g.fillStyle = '#161a44';
    g.beginPath();
    g.moveTo(x - 6, y);
    g.lineTo(x + w / 2, y - 22 - r() * 10);
    g.lineTo(x + w + 6, y);
    g.fill();
    g.strokeStyle = 'rgba(235,242,255,0.75)';
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x - 6, y);
    g.lineTo(x + w / 2, y - 22);
    g.lineTo(x + w + 6, y);
    g.stroke();
    // Fenster mit Schein
    const n = Math.max(1, Math.floor(w / 22));
    for (let i = 0; i < n; i++) {
      if (r() < 0.25) continue;
      const wx = x + 8 + i * ((w - 16) / n) + 2;
      const wy = y + 10;
      const glow = g.createRadialGradient(wx + 4, wy + 5, 0, wx + 4, wy + 5, 20);
      glow.addColorStop(0, 'rgba(255,190,90,0.45)');
      glow.addColorStop(1, 'rgba(255,190,90,0)');
      g.fillStyle = glow;
      g.fillRect(wx - 16, wy - 15, 40, 40);
      g.fillStyle = '#ffcf7a';
      g.fillRect(wx, wy, 8, 10);
    }
  }

  resize(vw: number): void {
    this.sprite.width = vw;
  }

  update(camX: number, dy: number): void {
    this.sprite.tilePosition.x = -parallaxOffset(camX, FACTOR, PERIOD);
    this.sprite.y = dy * FACTOR * 2 + 10;
  }

  destroy(): void {
    this.container.destroy({ children: true });
    this.tex.destroy(true);
  }
}
