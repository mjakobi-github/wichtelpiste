import { Container, Rectangle, Sprite, type Application, type Texture } from 'pixi.js';
import type { LevelData, Theme, Vec2 } from '../sim/types';
import type { Simulation } from '../sim/simulation';
import type { SimEvent } from '../sim/events';
import { clamp } from '../sim/geometry';
import { PLAYER_TUNING } from '../sim/player';
import { Camera } from './camera';
import { DebugDraw, lerp } from './debugDraw';
import { Backdrop } from './backdrop';
import { canvasTexture } from './backdrop/util';
import { Roofs } from './world/roofs';
import { GiftFlights, WorldObjects } from './world/objects';
import { Hazards } from './world/hazards';
import { Shake } from './fx/shake';
import { StrokeView } from './world/strokes';
import { Elf } from './actors/elf';
import { SledActor } from './actors/sled';
import { Particles } from './fx/particles';
import { Bloom } from './fx/bloom';
import { FpsMonitor, QUALITY, type QualityTier } from './quality';

const ZOOM_FOOT = 1;
const ZOOM_RIDE = 0.55;
/** Start-Zoom beim Planen; der Spieler kann ihn per Kneifen/Mausrad/Knöpfen ändern. */
const ZOOM_PLAN_DEFAULT = 0.85;
const ZOOM_PLAN_MIN = 0.35;
const ZOOM_PLAN_MAX = 2.5;
const ZOOM_RATE = 4;
const ZOOM_EDIT_MIN = 0.2;
const ZOOM_EDIT_MAX = 2.5;
/** Editor: so weit darf die Kamera über die Weltränder hinaus. */
const EDIT_MARGIN = 300;
/** Titel/Levelauswahl: die Kulisse driftet nur langsam – 30 Bilder/s reichen und sparen Akku/CPU. */
const MENU_FPS = 30;

/** Orchestriert die Darstellung: Hintergrund, Welt, Figuren, Effekte, Kamera, Qualität. */
export class GameView {
  readonly camera = new Camera();
  /** Welt in drei Ebenen mit gleicher Kamera: Bauten → Leuchtendes (mit Bloom) → Figuren. */
  private readonly world = new Container();
  private readonly glowWorld = new Container();
  private readonly frontWorld = new Container();
  /** Unskalierter Träger der Leuchtebene – Bloom-Filter in Bildschirmkoordinaten. */
  private readonly bloomHost = new Container();
  private readonly roofLights = new Container();
  private readonly roofLayer = new Container();
  private readonly strokes = new StrokeView();
  private readonly objLayer = new Container();
  private readonly objGlow = new Container();
  private objects: WorldObjects | null = null;
  private hazards: Hazards | null = null;
  private readonly flights = new GiftFlights();
  private readonly shake = new Shake();
  private readonly debug: DebugDraw | null;
  private readonly elf = new Elf();
  private readonly sled = new SledActor();
  private readonly particles = new Particles();
  private readonly backLayer = new Container();
  private readonly frontLayer = new Container();
  private readonly vignette: Sprite;
  private readonly vignetteTex: Texture;
  private readonly bloom: Bloom;
  private readonly fps: FpsMonitor;
  private tier: QualityTier;
  private backdrop: Backdrop | null = null;
  private roofs: Roofs | null = null;
  private level: LevelData | null = null;
  private lastTime = performance.now();
  /** In der Planungsphase: hat der Spieler selbst verschoben? Dann nicht mehr nachführen. */
  private panned = false;
  /** Vom Spieler gewählter Zoom beim Planen (bleibt über Levels hinweg erhalten). */
  private planZoom = ZOOM_PLAN_DEFAULT;
  private planning = false;
  private fpsLabel: HTMLElement | null = null;
  private fpsAcc = { ms: 0, n: 0 };
  private sledWasGrounded = true;
  private sledAir = 0;
  /** Editor: Kamera frei, Beweger-Bahnen sichtbar, Rendern auf Anforderung. */
  editMode = false;
  private roofKey = '';
  private sketch = false;
  /** Pixi-Ticker angehalten: vom Editor (Rendern auf Anforderung) bzw. im Menü (gedrosselt). */
  private manualRender = false;
  private menuMode = false;
  private lastMenuFrame = 0;
  /** Zähler für Messungen (Editor-Leistung). */
  readonly stats = { roofBuilds: 0, stillRenders: 0 };
  /** Editor-Ebene (Umrisse, Griffe) mit derselben Kamera wie die Welt. */
  readonly editorLayer = new Container();

  constructor(private readonly app: Application) {
    const params = new URLSearchParams(window.location.search);
    this.debug = params.has('debug') ? new DebugDraw() : null;
    const forced = params.get('q');
    this.tier = forced === 'low' || forced === 'medium' ? forced : 'high';

    this.world.addChild(this.roofLayer, this.objLayer);
    this.glowWorld.addChild(this.roofLights, this.objGlow, this.strokes.container, this.particles.container);
    this.frontWorld.addChild(this.sled.container, this.elf.container);
    if (this.debug) this.frontWorld.addChild(this.debug.container);
    this.vignetteTex = canvasTexture(256, 256, (g) => {
      const v = g.createRadialGradient(128, 128, 70, 128, 128, 182);
      v.addColorStop(0, 'rgba(0,0,10,0)');
      v.addColorStop(1, 'rgba(0,0,12,0.55)');
      g.fillStyle = v;
      g.fillRect(0, 0, 256, 256);
    });
    this.vignette = new Sprite(this.vignetteTex);
    this.bloomHost.addChild(this.glowWorld);
    app.stage.addChild(this.backLayer, this.world, this.bloomHost, this.frontWorld, this.frontLayer, this.vignette, this.flights.container, this.editorLayer);

    this.bloom = new Bloom(this.bloomHost);
    if (this.debug) {
      this.fpsLabel = document.createElement('div');
      this.fpsLabel.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9;font:12px monospace;color:#9fe8ff;background:#0008;padding:2px 6px;border-radius:4px;pointer-events:none';
      document.body.appendChild(this.fpsLabel);
    }
    this.fps = new FpsMonitor((t) => this.applyQuality(t), this.tier);
    this.applyQuality(this.tier);
  }

  get quality(): QualityTier { return this.tier; }

  private applyQuality(t: QualityTier): void {
    this.tier = t;
    const q = QUALITY[t];
    this.bloom.enabled = q.bloom;
    this.particles.amount = q.particles;
    const res = Math.min(window.devicePixelRatio || 1, q.resolution);
    if (this.app.renderer.resolution !== res) {
      this.app.renderer.resize(this.app.screen.width, this.app.screen.height, res);
    }
  }

  resize(w: number, h: number): void {
    this.camera.resize(w, h);
    this.backdrop?.resize(w, h);
    this.vignette.width = w;
    this.vignette.height = h;
    this.bloomHost.filterArea = new Rectangle(0, 0, w, h);
  }

  /** Kulisse ohne Spielebene (Titel, Levelauswahl): Hintergrund driftet langsam. */
  showScenery(theme: Theme): void {
    this.level = null;
    this.setWorldVisible(false);
    this.setMenuMode(true);
    this.mountBackdrop(theme);
    this.particles.clear();
    this.flights.clear();
  }

  renderScenery(): void {
    if (this.level || !this.backdrop) return;
    const now = performance.now();
    this.lastTime = now;
    // kleine Toleranz, damit 60-Hz-Bildschirme sauber jedes zweite Bild zeichnen
    if (now - this.lastMenuFrame < 1000 / MENU_FPS - 4) return;
    this.lastMenuFrame = now;
    const t = now / 1000;
    this.backdrop.update(t * 30, 0, t);
    this.app.render();
  }

  /** Menü: Ticker aus, renderScenery zeichnet selbst (gedrosselt); Spiel/Editor: normal. */
  private setMenuMode(on: boolean): void {
    this.menuMode = on;
    this.lastMenuFrame = 0;
    this.syncTicker();
  }

  private syncTicker(): void {
    if (this.manualRender || this.menuMode) this.app.ticker.stop();
    else this.app.ticker.start();
  }

  private setWorldVisible(v: boolean): void {
    for (const c of [this.world, this.bloomHost, this.frontWorld, this.flights.container]) c.visible = v;
  }

  private mountBackdrop(theme: Theme): void {
    this.backdrop?.destroy();
    this.backdrop = new Backdrop(theme, { w: this.camera.screenW, h: this.camera.screenH }, QUALITY[this.tier].particles);
    this.backLayer.addChild(this.backdrop.container);
    this.frontLayer.addChild(this.backdrop.front);
  }

  async load(level: LevelData): Promise<void> {
    this.buildWorld(level, false);
    this.camera.zoom = ZOOM_FOOT;
    this.camera.updateScale();
    this.camera.jump(level.spawn);
    this.panned = false;
  }

  /** Editor: Welt neu aufbauen, Kamera bleibt; Kulisse nur neu, wenn nötig. */
  showLevel(level: LevelData, opts: { keepBackdrop: boolean }): void {
    if (this.sketch) {
      // Skizze: keine Kulisse, keine Häuser/Objekte – die Editor-Ebene zeichnet alles als einfache Formen.
      this.level = level;
      this.setWorldVisible(true);
      this.setMenuMode(false);
      this.applySketchVisibility();
      this.camera.updateScale();
      return;
    }
    this.buildWorld(level, opts.keepBackdrop && this.backdrop !== null, true);
    this.applySketchVisibility();
    this.camera.updateScale();
  }

  /** reuseRoofs: Dächer/Häuser (teure Canvas-Texturen) behalten, wenn Plattformen, Seed und Höhe gleich sind. */
  private buildWorld(level: LevelData, keepBackdrop: boolean, reuseRoofs = false): void {
    this.level = level;
    this.setWorldVisible(true);
    this.setMenuMode(false);
    this.debug?.load(level);
    this.objects?.destroy();
    this.hazards?.destroy();
    this.objects = new WorldObjects(level);
    this.hazards = new Hazards(level);
    this.objLayer.addChild(this.objects.container, this.hazards.container);
    this.objGlow.addChild(this.objects.glow, this.hazards.glow);
    this.flights.clear();

    if (!keepBackdrop) this.mountBackdrop(level.theme);

    const roofKey = JSON.stringify([level.platforms, level.theme.seed, level.worldH]);
    if (!(reuseRoofs && this.roofs && roofKey === this.roofKey)) {
      this.roofs?.destroy();
      this.roofs = new Roofs(level);
      this.roofLayer.addChild(this.roofs.container);
      this.roofLights.addChild(this.roofs.lights);
      this.roofKey = roofKey;
      this.stats.roofBuilds++;
    }
    this.particles.clear();
  }

  /** Editor: zeichnet den Ruhezustand der Simulation mit freier Kamera (kein Schritt, keine Ereignisse). */
  /**
   * Editor: zeichnet den Ruhezustand der Simulation mit freier Kamera (kein Schritt, keine Ereignisse).
   * animate=false: Umgebung steht still (Rendern auf Anforderung).
   */
  renderStill(sim: Simulation, animate = true): void {
    if (!this.level) return;
    const now = performance.now();
    const frameMs = now - this.lastTime;
    const dt = animate ? Math.min(0.1, frameMs / 1000) : 0;
    this.lastTime = now;
    const t = animate ? now / 1000 : 0;
    this.stats.stillRenders++;
    const cam = this.camera;
    cam.updateScale();
    cam.clampLoose({ w: this.level.worldW, h: this.level.worldH }, EDIT_MARGIN);
    for (const w of [this.world, this.glowWorld, this.frontWorld, this.editorLayer]) {
      w.scale.set(cam.scale);
      w.position.set(-cam.left * cam.scale, -cam.top * cam.scale);
    }
    this.backdrop?.update(cam.cx, cam.cy, t);
    this.roofs?.update(t);
    this.strokes.update(sim.ink.strokes, t);
    this.objects?.update(sim, t, dt);
    this.hazards?.update(sim, t, true);
    this.renderActors(sim, 1, dt, t);
    this.particles.update(dt);
  }

  /** Editor-Ansicht „Skizze“: Kulisse, Welt, Leuchten, Vordergrund und Vignette aus. Danach showLevel aufrufen. */
  setSketch(on: boolean): void {
    if (this.sketch === on) return;
    this.sketch = on;
    if (on) {
      this.roofs?.destroy(); this.roofs = null; this.roofKey = '';
      this.objects?.destroy(); this.objects = null;
      this.hazards?.destroy(); this.hazards = null;
      this.backdrop?.destroy(); this.backdrop = null;
    }
    this.applySketchVisibility();
  }

  private applySketchVisibility(): void {
    const show = !this.sketch;
    for (const c of [this.backLayer, this.world, this.bloomHost, this.frontLayer, this.vignette]) c.visible = show;
  }

  /** Editor: Pixi-Ticker anhalten und nur noch über renderNow() zeichnen (an), oder normal (aus). */
  setManualRender(on: boolean): void {
    this.manualRender = on;
    this.syncTicker();
  }

  /** Ein Bild zeichnen (bei angehaltenem Ticker); misst die Dauer für die Qualitätsstufe. */
  renderNow(): void {
    const t0 = performance.now();
    this.app.render();
    const ms = performance.now() - t0;
    // Gemessen wird nur die Zeichendauer der tatsächlich gerenderten Bilder (ein langsames Gerät stuft ab).
    if (this.editMode) this.fps.sample(Math.max(ms, 1000 / 60));
  }

  cameraState(): { cx: number; cy: number; zoom: number } {
    return { cx: this.camera.cx, cy: this.camera.cy, zoom: this.camera.zoom };
  }

  setCameraState(s: { cx: number; cy: number; zoom: number }): void {
    this.camera.cx = s.cx;
    this.camera.cy = s.cy;
    this.camera.zoom = clamp(s.zoom, ZOOM_EDIT_MIN, ZOOM_EDIT_MAX);
    this.camera.updateScale();
  }

  render(sim: Simulation, alpha: number, events: SimEvent[]): void {
    if (!this.level) return;
    const now = performance.now();
    const frameMs = now - this.lastTime;
    const dt = Math.min(0.1, frameMs / 1000);
    this.lastTime = now;
    this.fps.sample(frameMs);
    if (this.fpsLabel) {
      this.fpsAcc.ms += frameMs;
      if (++this.fpsAcc.n >= 30) {
        this.fpsLabel.textContent = `${Math.round((this.fpsAcc.n * 1000) / this.fpsAcc.ms)} fps · ${this.tier}`;
        this.fpsAcc = { ms: 0, n: 0 };
      }
    }
    const t = now / 1000;

    for (const e of events) this.react(e, sim);

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

    this.shake.update(dt);
    const sh = this.shake.offset(t);
    for (const w of [this.world, this.glowWorld, this.frontWorld]) {
      w.scale.set(cam.scale);
      w.position.set(-cam.left * cam.scale + sh.x, -cam.top * cam.scale + sh.y);
    }
    this.backdrop?.update(cam.cx, cam.cy, t);
    this.roofs?.update(t);
    this.strokes.update(sim.ink.strokes, t);
    this.objects?.update(sim, t, dt);
    this.hazards?.update(sim, t, this.planning);
    this.flights.update(dt);
    this.debug?.render(sim, alpha);
    this.renderActors(sim, alpha, dt, t);
    this.particles.update(dt);
  }

  private renderActors(sim: Simulation, alpha: number, dt: number, t: number): void {
    const foot = sim.mode === 'foot';
    this.elf.container.visible = foot;
    this.sled.container.visible = !foot;
    if (foot) {
      const pl = sim.player;
      const p = lerp(pl.prevPos, pl.pos, alpha);
      this.elf.container.position.set(p.x + PLAYER_TUNING.size.w / 2, p.y + PLAYER_TUNING.size.h);
      this.elf.update({ vx: pl.vel.x, vy: pl.vel.y, grounded: pl.grounded, facing: pl.facing }, dt, t);
      return;
    }
    const s = sim.sled;
    const riding = sim.phase === 'ride';
    const p = riding ? lerp(s.prevPos, s.pos, alpha) : s.pos;
    this.sled.container.position.set(p.x, p.y);
    this.sled.update(s.angle, riding ? s.speed : 0, dt, t);
    if (!riding) { this.sledWasGrounded = true; return; }

    // Funken hinter den Kufen, Stärke ~ Tempo
    const grounded = s.grounded;
    if (grounded && s.speed > 120) {
      const k = clamp(s.speed / 1600, 0, 1);
      const n = Math.max(1, Math.round(dt * 60));
      // Berührpunkt unter dem hinteren Kufen-Ende (Normale zeigt zur Linie, also nach unten)
      const a = s.angle;
      const sgn = Math.cos(a) >= 0 ? 1 : -1;
      const at = { x: s.rear.x - Math.sin(a) * 5 * sgn, y: s.rear.y + Math.cos(a) * 5 * sgn };
      for (let i = 0; i < n; i++) this.particles.sparks(at, s.vel, k);
    }
    if (!grounded) this.sledAir += dt;
    else {
      if (!this.sledWasGrounded && this.sledAir > 0.15) {
        this.sled.land(this.sledAir);
        this.particles.snowPuff({ x: p.x, y: p.y + 5 }, Math.min(1.4, 0.4 + this.sledAir));
      }
      this.sledAir = 0;
    }
    this.sledWasGrounded = grounded;
  }

  private react(e: SimEvent, sim: Simulation): void {
    const fx = this.particles;
    switch (e.type) {
      case 'jump': {
        this.elf.jump();
        const pl = sim.player;
        fx.snowPuff({ x: pl.center.x, y: pl.pos.y + PLAYER_TUNING.size.h }, 0.35);
        break;
      }
      case 'land':
        this.elf.land(e.speed);
        if (e.speed > 250) fx.snowPuff(e.pos, clamp(e.speed / 1000, 0.3, 1.4));
        break;
      case 'gift': fx.burst(e.pos); this.flyGift(e.pos); break;
      case 'spring': fx.burst(e.pos, 0x40e0ff); this.objects?.springFired(e.pos); this.shake.kick(3); break;
      case 'checkpoint': fx.burst({ x: e.pos.x, y: e.pos.y - 50 }, 0xffc060); break;
      case 'crash': fx.snowPuff(e.pos, 1.5); fx.burst(e.pos, 0xff4d5e); this.shake.kick(8); break;
      case 'blocked': this.objects?.blocked(e.pos); break;
      case 'board': this.panned = false; fx.snowPuff(sim.level.stations[e.area].pos, 0.8); break;
      case 'launch': this.panned = false; break;
      case 'arrive': fx.snowPuff(e.pos, 0.8); break;
      case 'win': this.elf.cheer(); this.objects?.win(); fx.confetti({ x: sim.level.chimney.x, y: sim.level.chimney.y - 60 }); break;
      default: break;
    }
    if (e.type === 'crash') this.panned = false;
  }

  /** Geschenk-Sprite fliegt von der Weltposition zum HUD-Zähler (oben links als Rückfall). */
  private flyGift(p: Vec2): void {
    const cam = this.camera;
    const from = { x: (p.x - cam.left) * cam.scale, y: (p.y - cam.top) * cam.scale };
    let to = { x: 40, y: 20 };
    const el = document.querySelector('.hud-gifts');
    if (el) {
      const r = el.getBoundingClientRect();
      const c = this.app.canvas.getBoundingClientRect();
      if (r.width > 0) to = { x: r.left - c.left + 14, y: r.top - c.top + r.height / 2 };
    }
    this.flights.launch(from, to, cam.scale);
  }

  screenToWorld(x: number, y: number): Vec2 {
    return this.camera.screenToWorld(x, y);
  }

  panBy(dx: number, dy: number): void {
    this.panned = true;
    this.camera.cx -= dx / this.camera.scale;
    this.camera.cy -= dy / this.camera.scale;
    if (!this.level) return;
    if (this.editMode) this.camera.clampLoose({ w: this.level.worldW, h: this.level.worldH }, EDIT_MARGIN);
    else this.camera.clampTo({ w: this.level.worldW, h: this.level.worldH });
  }

  /** Zoomt beim Planen um Faktor f; der Bildschirmpunkt (x, y) bleibt fest. */
  zoomAt(f: number, x: number, y: number): void {
    if ((!this.planning && !this.editMode) || !this.level) return;
    const cam = this.camera;
    const before = cam.screenToWorld(x, y);
    if (this.editMode) cam.zoom = clamp(cam.zoom * f, ZOOM_EDIT_MIN, ZOOM_EDIT_MAX);
    else cam.zoom = this.planZoom = clamp(cam.zoom * f, ZOOM_PLAN_MIN, ZOOM_PLAN_MAX);
    cam.updateScale();
    const after = cam.screenToWorld(x, y);
    cam.cx += before.x - after.x;
    cam.cy += before.y - after.y;
    if (this.editMode) cam.clampLoose({ w: this.level.worldW, h: this.level.worldH }, EDIT_MARGIN);
    else cam.clampTo({ w: this.level.worldW, h: this.level.worldH });
    this.panned = true;
  }

  /** Zoom-Knöpfe: um die Bildschirmmitte */
  zoomStep(f: number): void {
    this.zoomAt(f, this.camera.screenW / 2, this.camera.screenH / 2);
  }

  destroy(): void {
    this.backdrop?.destroy();
    this.roofs?.destroy();
    this.objects?.destroy();
    this.hazards?.destroy();
    this.particles.destroy();
    this.vignetteTex.destroy(true);
    this.world.destroy({ children: true });
    this.bloomHost.destroy({ children: true });
    this.frontWorld.destroy({ children: true });
  }
}
