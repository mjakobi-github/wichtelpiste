import { Container } from 'pixi.js';
import sledSvg from '../../assets/svg/sled.svg?raw';
import { Elf } from './elf';
import { damp, svgPart } from './svg';

/**
 * Schlitten mit sitzender Elfe. Ursprung = Schlitten-Mitte der Physik
 * (5 px über der Kufen-Unterkante, s. SLED_TUNING.pointRadius); neigt sich
 * mit dem Kufenwinkel, mit kleinem Federn bei Landungen.
 */
export class SledActor {
  readonly container = new Container();
  private readonly tilt = new Container();
  private readonly body = svgPart(sledSvg, 27, 25);
  readonly elf = new Elf();
  private bounce = 0;
  private angle = 0;
  private facing: 1 | -1 = 1;

  constructor() {
    this.body.y = 5;
    this.elf.sit = true;
    this.elf.container.position.set(-3, -3);
    this.elf.container.scale.set(0.95);
    this.tilt.addChild(this.elf.container, this.body);
    this.container.addChild(this.tilt);
  }

  /** Aufsetzen nach Flugphase */
  land(airTime: number): void {
    this.bounce = Math.min(5, airTime * 10);
  }

  update(angle: number, speed: number, dt: number, t: number): void {
    // Fährt der Schlitten nach links, spiegeln statt auf den Kopf drehen (mit Hysterese)
    const c = Math.cos(angle);
    if (c < -0.2) this.facing = -1;
    else if (c > 0.2) this.facing = 1;
    if (this.facing < 0) angle -= Math.PI;
    this.tilt.scale.x = this.facing;
    // Winkel weich nachführen (kürzester Weg)
    let d = angle - this.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.angle += d * (1 - Math.exp(-25 * dt));
    this.tilt.rotation = this.angle;
    this.bounce = damp(this.bounce, 0, 10, dt);
    this.tilt.y = this.bounce * Math.sin(t * 40) * 0.3;
    this.elf.update({ vx: speed, vy: 0, grounded: true, facing: 1 }, dt, t);
  }
}
