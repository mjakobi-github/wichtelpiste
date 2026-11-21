import { Container, Sprite, type Texture } from 'pixi.js';
import { canvasTexture, hsl, VH, type Layer } from './util';

/** Himmel: Nachtblau → Violett, mit warmem Schimmer am Horizont (Faktor 0). */
export class Sky implements Layer {
  readonly container = new Container();
  private readonly tex: Texture;
  private readonly sprite: Sprite;

  constructor(hue: number) {
    this.tex = canvasTexture(4, VH, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, VH);
      gr.addColorStop(0, '#040720');
      gr.addColorStop(0.45, '#12154a');
      gr.addColorStop(0.75, '#2a2163');
      gr.addColorStop(1, hsl(hue + 140, 45, 26));
      g.fillStyle = gr;
      g.fillRect(0, 0, 4, VH);
    });
    this.sprite = new Sprite(this.tex);
    this.sprite.height = VH + 200;
    this.sprite.y = -100;
    this.container.addChild(this.sprite);
  }

  resize(vw: number): void {
    this.sprite.width = vw;
  }

  update(): void {}

  destroy(): void {
    this.container.destroy({ children: true });
    this.tex.destroy(true);
  }
}
