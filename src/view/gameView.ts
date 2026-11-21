import { Container, type Application } from 'pixi.js';
import type { LevelData, Vec2 } from '../sim/types';
import type { Simulation } from '../sim/simulation';
import type { SimEvent } from '../sim/events';
import { clamp } from '../sim/geometry';
import { Camera } from './camera';
import { DebugDraw, lerp } from './debugDraw';

const ZOOM_FOOT = 1;
const ZOOM_RIDE = 0.55;
/** Start-Zoom beim Planen; der Spieler kann ihn per Kneifen/Mausrad/Knöpfen ändern. */
const ZOOM_PLAN_DEFAULT = 0.85;
const ZOOM_PLAN_MIN = 0.35;
const ZOOM_PLAN_MAX = 2.5;
const ZOOM_RATE = 4;

/** Orchestriert die Darstellung: Kamera, Weltebene, später Hintergründe und Effekte. */
export class GameView {
  readonly camera = new Camera();
  private readonly world = new Container();
  private readonly debug = new DebugDraw();
  private level: LevelData | null = null;
  private lastTime = performance.now();
  /** In der Planungsphase: hat der Spieler selbst verschoben? Dann nicht mehr nachführen. */
  private panned = false;
  /** Vom Spieler gewählter Zoom beim Planen (bleibt über Levels hinweg erhalten). */
  private planZoom = ZOOM_PLAN_DEFAULT;
  private planning = false;

  constructor(private readonly app: Application) {
    this.world.addChild(this.debug.container);
    app.stage.addChild(this.world);
  }

  resize(w: number, h: number): void {
    this.camera.resize(w, h);
  }

  async load(level: LevelData): Promise<void> {
    this.level = level;
    this.debug.load(level);
    this.camera.zoom = ZOOM_FOOT;
    this.camera.updateScale();
    this.camera.jump(level.spawn);
    this.panned = false;
  }

  render(sim: Simulation, alpha: number, events: SimEvent[]): void {
    if (!this.level) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;

    for (const e of events) if (e.type === 'board' || e.type === 'launch' || e.type === 'crash') this.panned = false;

    const cam = this.camera;
    this.planning = sim.mode === 'sled' && sim.phase === 'plan';
    const target = sim.mode === 'foot' ? ZOOM_FOOT : this.planning ? this.planZoom : ZOOM_RIDE;
    cam.zoom += (target - cam.zoom) * (1 - Math.exp(-ZOOM_RATE * dt));
    cam.updateScale();

    if (sim.mode === 'foot') {
      const c = lerp(sim.player.prevPos, sim.player.pos, alpha);
      cam.follow({ x: c.x + 15 + 70 * sim.player.facing, y: c.y - cam.viewH * 0.05 }, 6, dt);
    } else if (sim.phase === 'ride') {
      const p = lerp(sim.sled.prevPos, sim.sled.pos, alpha);
      cam.follow({ x: p.x + clamp(sim.sled.vel.x * 0.35, -260, 260), y: p.y }, 5, dt);
    } else if (!this.panned) {
      const st = sim.level.stations[sim.activeArea].pos;
      cam.follow({ x: st.x + cam.viewW * 0.25, y: st.y }, 4, dt);
    }
    cam.clampTo({ w: this.level.worldW, h: this.level.worldH });

    this.world.scale.set(cam.scale);
    this.world.position.set(-cam.left * cam.scale, -cam.top * cam.scale);
    this.debug.render(sim, alpha);
    void this.app;
  }

  screenToWorld(x: number, y: number): Vec2 {
    return this.camera.screenToWorld(x, y);
  }

  panBy(dx: number, dy: number): void {
    this.panned = true;
    this.camera.cx -= dx / this.camera.scale;
    this.camera.cy -= dy / this.camera.scale;
    if (this.level) this.camera.clampTo({ w: this.level.worldW, h: this.level.worldH });
  }

  /** Zoomt beim Planen um Faktor f; der Bildschirmpunkt (x, y) bleibt fest. */
  zoomAt(f: number, x: number, y: number): void {
    if (!this.planning || !this.level) return;
    const cam = this.camera;
    const before = cam.screenToWorld(x, y);
    this.planZoom = clamp(cam.zoom * f, ZOOM_PLAN_MIN, ZOOM_PLAN_MAX);
    cam.zoom = this.planZoom;
    cam.updateScale();
    const after = cam.screenToWorld(x, y);
    cam.cx += before.x - after.x;
    cam.cy += before.y - after.y;
    cam.clampTo({ w: this.level.worldW, h: this.level.worldH });
    this.panned = true;
  }

  /** Zoom-Knöpfe: um die Bildschirmmitte */
  zoomStep(f: number): void {
    this.zoomAt(f, this.camera.screenW / 2, this.camera.screenH / 2);
  }

  destroy(): void {
    this.world.destroy({ children: true });
  }
}
