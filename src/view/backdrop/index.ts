import { Container } from 'pixi.js';
import type { Theme } from '../../sim/types';
import { Aurora } from './aurora';
import { Forest } from './forest';
import { ForegroundSnow } from './foregroundSnow';
import { Moon } from './moon';
import { Mountains } from './mountains';
import { Sky } from './sky';
import { Stars } from './stars';
import { VH, type Layer } from './util';

export { mountainProfile, parallaxOffset } from './util';

/**
 * Prozeduraler Winternacht-Hintergrund (Spec §6.1). `container` liegt hinter
 * der Welt, `front` (Schneefall vorne) darüber. Alles in virtuellen Einheiten
 * mit Höhe 540, auf die Bildschirmhöhe skaliert.
 */
export class Backdrop {
  readonly container = new Container();
  readonly front = new Container();
  private readonly back: Layer[];
  private readonly snow: ForegroundSnow;
  private anchorY: number | null = null;

  constructor(theme: Theme, view: { w: number; h: number }, density = 1) {
    this.back = [
      new Sky(theme.auroraHue),
      new Stars(theme.seed, density),
      new Aurora(theme.auroraHue),
      new Moon(theme.seed),
      new Mountains(theme.seed, theme.auroraHue),
      new Forest(theme.seed),
    ];
    for (const l of this.back) this.container.addChild(l.container);
    this.snow = new ForegroundSnow(theme.seed, density);
    this.front.addChild(this.snow.container);
    this.resize(view.w, view.h);
  }

  resize(w: number, h: number): void {
    const s = h / VH;
    const vw = w / s;
    this.container.scale.set(s);
    this.front.scale.set(s);
    for (const l of this.back) l.resize(vw);
    this.snow.resize(vw);
  }

  /** camX/camY = Kameramitte in Weltpixeln, time in Sekunden. */
  update(camX: number, camY: number, time: number): void {
    if (this.anchorY === null) this.anchorY = camY;
    // vertikale Parallaxe: gedämpft und begrenzt, damit der Horizont im Bild bleibt
    const dy = Math.max(-90, Math.min(90, (this.anchorY - camY) * 0.5));
    for (const l of this.back) l.update(camX, dy, time);
    this.snow.update(camX, dy, time);
  }

  destroy(): void {
    for (const l of this.back) l.destroy();
    this.snow.destroy();
    this.container.destroy();
    this.front.destroy();
  }
}
