import type { Vec2 } from '../sim/types';
import { clamp } from '../sim/geometry';

/**
 * Kamera über den Mittelpunkt der Sicht. scale = Bildschirm-px pro Welt-px.
 * Folgt weich (exponentiell) und klemmt an die Weltränder.
 */
export class Camera {
  cx = 0;
  cy = 0;
  scale = 1;
  zoom = 1;
  screenW = 1;
  screenH = 1;

  resize(w: number, h: number): void {
    this.screenW = w;
    this.screenH = h;
  }

  /** Basis-Maßstab wie im POC: gleiche Weltgröße auf Handy und Desktop. */
  updateScale(): void {
    this.scale = Math.max(this.screenH / 560, this.screenW / 1100) * this.zoom;
  }

  get viewW(): number { return this.screenW / this.scale; }
  get viewH(): number { return this.screenH / this.scale; }
  get left(): number { return this.cx - this.viewW / 2; }
  get top(): number { return this.cy - this.viewH / 2; }

  follow(target: Vec2, rate: number, dt: number): void {
    const f = 1 - Math.exp(-rate * dt);
    this.cx += (target.x - this.cx) * f;
    this.cy += (target.y - this.cy) * f;
  }

  jump(target: Vec2): void {
    this.cx = target.x;
    this.cy = target.y;
  }

  clampTo(world: { w: number; h: number }): void {
    const hw = this.viewW / 2;
    const hh = this.viewH / 2;
    this.cx = world.w > this.viewW ? clamp(this.cx, hw, world.w - hw) : world.w / 2;
    this.cy = clamp(this.cy, hh - 200, Math.max(hh - 200, world.h - hh));
  }

  screenToWorld(x: number, y: number): Vec2 {
    return { x: this.left + x / this.scale, y: this.top + y / this.scale };
  }
}
