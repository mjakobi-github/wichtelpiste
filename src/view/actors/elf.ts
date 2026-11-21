import { Container } from 'pixi.js';
import bodySvg from '../../assets/svg/elf-body.svg?raw';
import headSvg from '../../assets/svg/elf-head.svg?raw';
import hatSvg from '../../assets/svg/elf-hat.svg?raw';
import legSvg from '../../assets/svg/elf-leg.svg?raw';
import { damp, svgPart } from './svg';

export interface ElfState { vx: number; vy: number; grounded: boolean; facing: 1 | -1 }

const SCALE = 0.82;

/**
 * Die Elfe aus SVG-Teilen. Ursprung = Mitte zwischen den Füßen.
 * Animationen: Lauf-Wippen, Beinschwung, Bommel im Wind, Sprung-Stauchung, Lande-Squash.
 */
export class Elf {
  readonly container = new Container();
  private readonly inner = new Container();
  private readonly legBack = svgPart(legSvg, 5, 0);
  private readonly legFront = svgPart(legSvg, 5, 0);
  private readonly body = svgPart(bodySvg, 14, 17);
  private readonly head = svgPart(headSvg, 15, 21);
  private readonly hat = svgPart(hatSvg, 18.5, 21);
  private phase = 0;
  private sx = 1;
  private sy = 1;
  private hatRot = 0;
  private sitting = false;

  constructor() {
    this.legBack.tint = 0xb8c0d0;
    this.legBack.x = -4;
    this.legFront.x = 2;
    this.inner.addChild(this.legBack, this.body, this.legFront, this.head, this.hat);
    this.inner.scale.set(SCALE);
    this.container.addChild(this.inner);
    this.layout(0);
  }

  /** Sitzend im Schlitten: Beine nach vorne, kein Laufen. */
  set sit(v: boolean) {
    this.sitting = v;
  }

  jump(): void {
    this.sx = 0.8;
    this.sy = 1.25;
  }

  land(impact: number): void {
    const k = Math.min(1, Math.max(0, (impact - 250) / 900));
    if (k <= 0) return;
    this.sx = 1 + 0.3 * k;
    this.sy = 1 - 0.3 * k;
  }

  /** Jubeln (z. B. beim Ziel): kleiner Hüpfer. */
  cheer(): void {
    this.sx = 0.85;
    this.sy = 1.2;
  }

  update(s: ElfState, dt: number, t: number): void {
    const speed = Math.abs(s.vx);
    const moving = s.grounded && speed > 20 && !this.sitting;
    if (moving) this.phase += dt * (6 + speed * 0.035);
    else this.phase = damp(this.phase, Math.round(this.phase / Math.PI) * Math.PI, 10, dt);

    this.sx = damp(this.sx, 1, 12, dt);
    this.sy = damp(this.sy, 1, 12, dt);
    this.inner.scale.set(SCALE * this.sx * s.facing, SCALE * this.sy);

    if (this.sitting) {
      this.legBack.rotation = -1.35;
      this.legFront.rotation = -1.45;
    } else if (!s.grounded) {
      this.legBack.rotation = s.vy < 0 ? 0.55 : 0.25;
      this.legFront.rotation = s.vy < 0 ? -0.5 : -0.2;
    } else {
      const swing = moving ? Math.sin(this.phase) * Math.min(0.7, 0.25 + speed / 600) : 0;
      this.legBack.rotation = swing;
      this.legFront.rotation = -swing;
    }

    // Bommel: hängt nach hinten beim Laufen, hebt sich beim Fallen, wippt im Wind
    const lean = -Math.min(1, speed / 300) * 0.35 * (this.sitting ? 0.4 : 1);
    const fall = s.grounded ? 0 : Math.max(-0.35, Math.min(0.35, s.vy / 2500));
    const wind = Math.sin(t * 2.6) * 0.07 + Math.sin(t * 7.1) * 0.03;
    this.hatRot = damp(this.hatRot, lean + fall + wind, 8, dt);
    this.layout(moving ? Math.abs(Math.sin(this.phase)) : 0);
  }

  private layout(bob: number): void {
    const sit = this.sitting;
    const hipY = sit ? -6 : -15;
    this.legBack.y = this.legFront.y = hipY;
    const by = hipY + 2 - bob * 1.6;
    this.body.position.set(0, by);
    this.head.position.set(1, by - 13 + bob * 0.4);
    this.head.rotation = sit ? 0.05 : bob * 0.04;
    this.hat.position.set(1, by - 29 + bob * 0.4);
    this.hat.rotation = this.hatRot;
  }
}
